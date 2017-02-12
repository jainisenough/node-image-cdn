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
		server: 'ds149049.mlab.com',
		port: '49049',
		name: 'imagecdn',
		username: 'root',
		password: 'toor',
		writeConcern: 1
	},
	log: {
		enable: true,
		ttl: 30 * 24 * 60 * 60
	},
	base: 'files/',
	cache: {
		enable: false,
		ttl: 30 * 60 * 1000
	}
};
