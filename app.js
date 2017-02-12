const mongoClient = require('mongodb').MongoClient;
const async = require('async');
const sharp = require('sharp');
const fileType = require('file-type');
const useragent = require('useragent');
const fs = require('fs');
const http = require('http');
const https = require('https');
const url = require('url');
const config = require('./config');
const Image = require('./class/image');

/************ Configuration ******************/
//mongo connection
let log;
if(config.log.enable) {
	mongoClient.connect(`${config.db.type}db://${config.db.server}:${config.db.port}/${config.db.name}`,
		(err, db) => {
			if(err) throw err;
			log = db.collection('log');
		});
}

/************ Private function ******************/
/*
 @format http://192.168.1.105:3015/<app-name>/<file-type>/<directory-path>/<options>/<file-name>
 @example http://192.168.1.105:3015/demo/image/upload/Desert.jpg
 */

//send response
function sendResponse(req, res, next, buffer, crop = false) {
	//create image manipulation object
	new Promise((resolve, reject) => {
		if(crop) {
			new Image(crop)
				.manipulateImage(buffer)
				.then(resolve)
				.catch(reject);
		} else {
			resolve(buffer);
		}
	}).then((buf) => {
		const agent = useragent.is(req.headers['user-agent']);
		new Promise((resolve, reject) => {
			if(agent.chrome || agent.opera || agent.android) {
				sharp(buf)
					.toFormat(sharp.format.webp)
					.toBuffer()
					.then(resolve)
					.catch(reject);
			} else {
				resolve(buf);
			}
		}).then((b) => {
			const fType = fileType(b);
			const contentType = fType ? fType.mime : 'text/plain';
			res.writeHead(200, {'Content-Type': contentType});
			res.end(b, 'binary');
		}).catch(err => console.log(err));
	}).catch(err => console.log(err));
}

//routing method
function routes() {
	return function(req, res, next) {
		if(req.method === 'GET') {
			const requestUrl = url.parse(req.url);
			let parseUrl = requestUrl.pathname.replace(/^\/|\/$/g, '');
			parseUrl = parseUrl.split('/');
			let f = parseUrl[parseUrl.length - 1];

			//add protocol, if not
			if(f.indexOf('http')) {
				f = `http%3A${f}`;
			}

			try {
				f = decodeURIComponent(f);
			} catch (e) {}

			//validate either link or name
			const link = url.parse(f);
			const fName = f.substring(f.lastIndexOf('/'));
			const fPath = `${config.base}${parseUrl[2]}/${fName}`;
			const adapter = link.protocol.toLowerCase().slice(0, -1) === 'https' ? https : http;

			//download image
			if(link.hostname) {
				async.parallel([
					function(cbk) {
						adapter.request({method: 'HEAD', hostname: link.hostname, port: link.port, path: link.path},
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
				], (err, resp) => {
					if(resp && resp[0]) {
						if(resp[1] && Number(resp[0]['content-length']) === resp[1].size) {
							//deliver remote file local copy
							fs.readFile(fPath, (err2, data) => {
								sendResponse(req, res, next, data, parseUrl.length > 4 ? {
									option: parseUrl[parseUrl.length - 2]
								} : false);
							});
						} else {
							const file = fs.createWriteStream(fPath);
							adapter.get(f, (response) => {
								if(response.statusCode === 200) {
									const data = [];
									response.pipe(file);
									response.on('data', (chunk) => {
										data.push(chunk);
									});

									file.on('error', (e) => {
										fs.unlink(fPath);
										sendResponse(req, res, next, `Got error: ${e.message}`);
									}).on('finish', () => {
										file.close();
										sendResponse(req, res, next, Buffer.concat(data), parseUrl.length > 4 ? {
											option: parseUrl[parseUrl.length - 2]
										} : false);
									});
								} else {
									sendResponse(req, res, next, 'Remote file missing.');
								}
							});
						}
					} else {
						sendResponse(req, res, next, 'Remote file missing.');
					}
				});
			} else {
				//deliver local file
			}

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

					if(config.log.ttl) {
						saveObj.ttl = config.log.ttl;
					}
					log.insertOne(saveObj, {w: config.db.writeConcern}, () => {});
				});
			}
		} else {
			sendResponse(req, res, next, 'What you are looking for?');
		}
	};
}

/*********Initialize Server**********************/
let serv;
if(typeof process.env.HTTP === 'undefined' || process.env.HTTP) {
	serv = http.createServer(routes());
} else {
	serv = https.createServer({
		key: fs.readFileSync(config.server.ssl.key),
		cert: fs.readFileSync(config.server.ssl.cert),
		ca: fs.readFileSync(config.server.ssl.ca)
	}, routes());
}

serv.timeout = config.server.timeout;
serv.listen(process.env.PORT || config.port, config.host, () => {
	console.log(`Server initialize http${(process.env.HTTP === 'false' ? 's' : '')}://${config.host}:\
${process.env.PORT || config.port}`);
});
