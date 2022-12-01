'use strict';
import { MongoClient } from 'mongodb';
import sharp from 'sharp';
import pLimit from 'p-limit';
import { CronJob } from 'cron';
import {fileTypeFromBuffer} from 'file-type';
import uaParserJs from 'ua-parser-js';
import { readdir, readFile, stat, unlink } from 'fs/promises';
import { readFileSync, createWriteStream } from 'fs';
import {join} from 'path';
import { promisify } from 'util';
import http from 'http';
import https from 'https';
import {parse as urlParse} from 'url';
import crypto from 'crypto';
import config from './config.js';
import Image from './class/image.js';

https.request[promisify.custom] = (options) => new Promise((resolve, reject) => https.request(options, resolve).on('error', reject).end());
https.get[promisify.custom] = (filePath) => new Promise((resolve, reject) => https.get(filePath, resolve).on('error', reject));
http.request[promisify.custom] = (options) => new Promise((resolve, reject) => http.request(options, resolve).on('error', reject).end());
http.get[promisify.custom] = (filePath) => new Promise((resolve, reject) => http.get(filePath, resolve).on('error', reject));

const limit = pLimit(5);
let log;
/************ Configuration ******************/

/************ Private function ******************/
/*
 @format http://192.168.1.105:3015/<app-name>/<file-type>/<directory-path>/<options>/<file-name>
 @example http://192.168.1.105:3015/demo/image/upload/Desert.jpg
 */

//send response
const sendResponse = async(req, res, next, buffer, crop = false) => {
	//create image manipulation object
	try {
		let buf = buffer;
		if(crop) {
			buf = await new Image(crop).manipulateImage(buf);
		}

		const agent = uaParserJs(req.headers['user-agent']);
		agent.browser.name = agent.browser?.name.toLowerCase();

		if(agent.browser.name === 'chrome' ||
			agent.browser.name === 'edge' ||
			agent.browser.name === 'opera' ||
			agent.browser.name === 'android') {
				buf = await sharp(buf).toFormat(sharp.format.webp).toBuffer();
		}

		const fType = await fileTypeFromBuffer(buf);
		const headers = {
			'Content-Type': fType ? fType.mime : 'text/plain',
			'Content-Length': buf.length
		};
		if(config.cache.enable) {
			headers['Cache-Control'] = `public, max-age=${config.cache.maxAge / 1000}`;
			headers.Expires = new Date(Date.now() + config.cache.maxAge).toUTCString();
			headers.ETag = `W/${crypto.createHash('md4').update(req.url).digest('hex')}`;
		}

		res.writeHead(200, headers);
		res.end(buf, 'binary');
	} catch(err) {
		console.log(err);
	}
}

//routing method
const routes = (req, res, next) => {
		if(req.method === 'GET') {
			const requestUrl = urlParse(req.url);
			let parseUrl = requestUrl.pathname.replace(/^\/|\/$/g, '').split('/');
			let f = parseUrl[parseUrl.length - 1];

			//add protocol, if not
			if(f.indexOf('http'))
				f = `http%3A${f}`;

			try {
				f = decodeURIComponent(f);
			} catch (e) {}
			
			//validate either link or name
			const link = urlParse(f);
			const fName = f.substring(f.lastIndexOf('/'));

			if(parseUrl[2]) {
				const fPath = join(config.base, parseUrl[2], fName);
				const adapter = link.protocol.toLowerCase().slice(0, -1) === 'https' ? https : http;

				(async () => {
					if(link.hostname) {
						try {
							const [remoteData, localData] = await Promise.all([
								promisify(adapter.request)({...link, method: 'HEAD'}),
								stat(fPath).catch(Promise.resolve.bind(Promise, null))
							]);
							
							if(localData && localData.size === Number(remoteData.headers['content-length'])) {
								const data = await readFile(fPath);
								await sendResponse(req, res, next, data, parseUrl.length > 4 ? {
									option: parseUrl[parseUrl.length - 2]
								} : false);
							} else {
								const file = createWriteStream(fPath);
								try {
									const response = await promisify(adapter.get)(f);

									if(response.statusCode === 200) {
										const data = [];
										response.pipe(file);
										response.on('data', (chunk) => {
											data.push(chunk);
										});
		
										response.on('end', async () => {
											await sendResponse(req, res, next, Buffer.concat(data), parseUrl.length > 4 ? {
												option: parseUrl[parseUrl.length - 2]
											} : false);
										});
									} else {
										unlink(fPath);
										res.end(JSON.stringify({
											code: 404,
											success: 'FAIL',
											message: 'Remote file missing.'
										}));
									}
								} catch(err2) {
									unlink(fPath);
									console.log(err2);
									const resp = JSON.stringify({
										code: 418,
										success: 'FAIL',
										message: err2.message
									});
									res.statusCode = 418;
									res.setHeader('Content-Length', resp.length);
									res.end(resp);
								}
							}
						} catch(err) {
							console.log(err);
							const resp = JSON.stringify({
								code: 418,
								success: 'FAIL',
								message: err.message
							});
							res.statusCode = 418;
							res.setHeader('Content-Length', resp.length);
							res.end(resp);
						}
					} else {
						//deliver local file
					}
				})();

				//log hook
				if(config.log.enable) {
					res.once('finish', () => {
						const saveObj = {
							url: `${req.headers.host}${req.url}`,
							ip: req.connection.remoteAddress || req.socket.remoteAddress
							|| (req.connection.socket && req.connection.socket.remoteAddress),
							token: req.headers.token,
							agent: req.headers['user-agent'],
							created: new Date()
						};

						if(config.log.ttl)
							saveObj.ttl = new Date(new Date().getTime() + config.log.ttl);
						log.insertOne(saveObj, {w: config.db.writeConcern});
					});
				}
			} else {
				console.log(`Invalid request url format: ${req.url}`);
			}
		} else {
			//method not allowed
			res.statusCode = 405;
			res.setHeader('Allow', 'GET');
			res.setHeader('Content-Length', '0');
			res.end();
		}
	};

/*********Initialize Server**********************/
let server;
if(typeof process.env.HTTP === 'undefined' || process.env.HTTP)
	server = http.createServer.bind(http);
else {
	server = https.createServer.bind(https, {
		key: readFileSync(config.server.ssl.key),
		cert: readFileSync(config.server.ssl.cert),
		ca: readFileSync(config.server.ssl.ca)
	});
}

const serv = server(routes);

serv.timeout = config.server.timeout;
serv.listen(process.env.PORT || config.port, config.host, async () => {
	console.log(`Server initialize http${(process.env.HTTP === 'false' ? 's' : '')}://${config.host}:\
${process.env.PORT || config.port}`);

	//setup cron job
	new CronJob('0 0 * * * *', async () => {
		try {
			const dirs = await readdir(config.base);
			const filesSettled = await Promise.allSettled(dirs.map(dir => limit(() => readdir(join(config.base, dir)))));
			const filePaths = filesSettled.reduce((ini, dirFiles, idx) => dirFiles.status === 'fulfilled' ? [...ini, ...dirFiles.value.map(f => join(config.base, dirs[idx], f))] : ini, []);
			const fileStatsSettled = await Promise.allSettled(filePaths.map(file => limit(() => stat(file))));
			const fileStats = fileStatsSettled.reduce((ini, fStats) => fStats.status === 'fulfilled' ? [...ini, fStats.value] : ini, []);
			const filesToDelete = fileStats.reduce((ini, fStats, idx) => fStats && fStats.mtime && (new Date(fStats.mtime).getTime() + config.cache.maxAge) < Date.now() ? [...ini, filePaths[idx]] : ini, []);
			Promise.allSettled(filesToDelete.map(file => limit(() => unlink(file))));
		} catch(err) {
			console.log(err);
		}
	}, null, true);

	//mongo connection
	if(config.log.enable) {
		let connectionString = `${config.db.type}db://`;
		if(config.db.username || config.db.password)
			connectionString += `${config.db.username}:${config.db.password}@`;
		connectionString += `${config.db.server}:${config.db.port}`;
		const mongoClient = new MongoClient(connectionString);
		try {
			await mongoClient.connect();
			const db = mongoClient.db(config.db.name);
			log = db.collection('log');
		} catch(mongoErr) {
			console.log(mongoErr);
		} finally {
			mongoClient.close();
		}
	}
});
