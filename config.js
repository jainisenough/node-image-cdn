// configuration file
module.exports = {
	host: '192.168.1.105',
	port: 3015,
	postMaxSize: 10 * 1024,
	server: {
		ssl: {
			key: '',
			cert: '',
			ca: ''
		},
		timeout: 2 * 60 * 1000
	},
	db: {
		type: 'mongo',
		server: '192.168.1.105',
		port: '27017',
		name: 'imagecdn',
		username: '',
		password: '',
		writeConcern: 1
	},
	base: 'files/',
	cache: {
		enable: false,
		ttl: 30 * 60 * 1000
	}
};
