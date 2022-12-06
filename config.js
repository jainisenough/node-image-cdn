//configuration file
export default {
	host: '0.0.0.0',
	port: 3010,
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
		name: 'imagecdn'
	},
	log: {
		enable: true,
		ttl: 30 * 24 * 60 * 60 * 1000
	},
	base: 'files',
	cache: {
		enable: true,
		maxAge: 1 * 60 * 60 * 1000
	}
};
