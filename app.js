'use strict';
const mongoClient = require('mongodb').MongoClient;
const async = require('async');
const mime = require('mime');
const fs = require('fs');
const http = require('http');
const url = require('url');
const config = require('./config');
//const Image = require('./class/image');
const server = require((typeof process.env.HTTP === 'undefined' || process.env.HTTP === 'true') ?
	'http' : 'spdy');

/************Configuration******************/
// mongo connection
let log;
if(process.env.NODE_ENV === 'local') {
	mongoClient.connect(`${config.db.type}db://${config.db.server}:${config.db.port}/${config.db.name}`,
		(err, db) => {
			if (err) throw err;
			log = db.collection('log');
		});
}

/************Private function******************/
/*
 @format http://192.168.1.105:3015/<app-name>/<file-type>/<directory-path>/<options>/<file-name>
 @example http://192.168.1.105:3015/demo/image/upload/Desert.jpg
 */

//send response
function sendResponse(res, buffer, contentType, crop) {
	crop = crop || false;

	//create image manipulation object
	if(crop) {
		let obj = new Image(crop);
		obj.manipulateImage(buffer).then((err, resp) => {
			console.log('Testinggggggggggggggggggggggg');
			res.writeHead(200, {'Content-Type': contentType});
			res.end(resp, 'binary');
		});
	} else {
		res.writeHead(200, {'Content-Type': contentType});
		res.end(buffer, 'binary');
	}
}

//routing method
function routes(req, res) {
	if (req.method === 'GET') {
		let requestUrl = url.parse(req.url);
		let parseUrl = requestUrl.pathname.replace(/^\/|\/$/g, '');
		parseUrl = parseUrl.split('/');
		let f = parseUrl[parseUrl.length - 1];

		//add protocol, if not
		if(f.indexOf('http') === -1)
			f = 'http%3A' + f;

		try {
			f = decodeURIComponent(f);
		} catch (e) {}

		//validate either link or name
		let link = url.parse(f);
		let fName = f.substring(f.lastIndexOf('/'));
		let fPath = `${config.base}${parseUrl[2]}/${fName}`;

		//download image
		if(link.hostname) {
			async.parallel([
				function(cbk) {
					http.request({method: 'HEAD', hostname: link.hostname, port: link.port, path: link.path},
						(resp) => {
						cbk(null, resp.headers);
					}).on('error', (e) => {
						cbk(e, null);
					}).end();
				},
				function(cbk) {
					fs.stat(fPath, (err, resp) => {
						if(err) cbk(null, null);
						else cbk(null, resp);
					});
				}
			], function(err, resp) {
				if(resp && resp[0]) {
					if(resp[1] && Number(resp[0]['content-length']) === resp[1].size) {
						//deliver remote file local copy
						fs.readFile(fPath, (err, data) => {
							sendResponse(res, data, mime.lookup(fName), parseUrl.length > 4 ? {
								option: parseUrl[parseUrl.length - 2]
							} : false);
						});
					} else {
						let file = fs.createWriteStream(fPath);
						http.get(f, (response) => {
							if (response.statusCode === 200) {
								let data = [];
								response.pipe(file);
								response.on('data', (chunk) => {
									data.push(chunk);
								});

								file.on('error', (e) => {
									fs.unlink(fPath);
									sendResponse(res, `Got error: ${e.message}`, 'text/plain');
								}).on('finish', () => {
									file.close();
									sendResponse(res, Buffer.concat(data), mime.lookup(fName), parseUrl.length > 4 ? {
										option: parseUrl[parseUrl.length - 2]
									} : false);
								});
							}
						});
					}
				} else {
					sendResponse(res, 'Remote file missing.', 'text/plain');
				}
			});
		} else {
			//deliver local file
		}

		//log hook
		if(process.env.NODE_ENV === 'local') {
			res.once('finish', () => {
				log.insertOne({
					url: `${req.headers.host}${req.url}`,
					ip: req.connection.remoteAddress || req.socket.remoteAddress
					|| (req.connection.socket && req.connection.socket.remoteAddress),
					token: req.headers.token,
					agent: req.headers['user-agent'],
					created: new Date()
				}, {w: config.db.writeConcern}, () => {});
			});
		}
	} else {
		sendResponse(res, 'What you are looking for?', 'text/plain');
	}
}

/*********Initialize Server**********************/
let serv;
if (typeof process.env.HTTP === 'undefined' || process.env.HTTP) {
	serv = server.createServer(routes);
} else {
	serv = server.createServer({
		key: fs.readFileSync(config.server.ssl.key),
		cert: fs.readFileSync(config.server.ssl.cert),
		ca: fs.readFileSync(config.server.ssl.ca)
	}, routes);
}

serv.timeout = config.server.timeout;
serv.listen(process.env.PORT || config.port, config.host, () => {
	console.log(`Server initialize http${(process.env.HTTP === 'false' ? 's' : '')}://${config.host}:\
${process.env.PORT || config.port}`);
});
