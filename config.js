//configuration file
module.exports = {
	host: '0.0.0.0',
	port: 3000,
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
		server: '<sccount_id>.mlab.com',
		port: '<port>',
		name: 'imagecdn',
		username: '',
		password: '',
		writeConcern: 0
	},
	log: {
		enable: true,
		ttl: 30 * 24 * 60 * 60 * 1000
	},
	base: 'files/',
	cache: {
		enable: true,
		maxAge: 1 * 60 * 60
	}
};
