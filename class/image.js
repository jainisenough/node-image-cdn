'use strict';
const sharp = require('sharp');
const fileType = require('file-type');
const useragent = require('useragent');
const _ = require('lodash');
const configuration = {
	image: {
		quality: 60,
		compression: 6,
		blur: 0.5
	}
};

module.exports = class ImageManipulation {
	constructor(req, crop) {
		this.imageOption = {
			progressive: true
		};
		this.req = req;
		this.ext = 'jpeg';
		this.option = {};
		this.webp = crop.webp || true;

		//merge image options
		_.assignIn(this.imageOption, crop.imageOption);

		//merge option
		if(crop.option) {
			crop.option.split(',').forEach(v => {
				let temp = v.split('_');
				if(temp.length === 2)
					this.option[temp[0]] = isNaN(temp[1]) ? temp[1] : Number(temp[1]);
			});
		}
	}

	manipulateImage(buffer) {
		let agent = useragent.is(this.req.headers['user-agent']);
		let fType = fileType(buffer);
		if(fType)
			this.ext = fType.ext === 'jpg' ? 'jpeg' : fType.ext;

		_.assignIn(this.imageOption, this.ext === 'png' ? {
			compressionLevel: this.option.q ? parseInt(this.option.q/11.11) : configuration.image.compression
		}:{
			quality: this.option.q || configuration.image.quality
		});

		let img = sharp(buffer)[this.ext](this.imageOption)
			.blur(this.option.b || configuration.image.blur);
		if(this.option.w || this.option.h)
			img = img.resize(this.option.w, this.option.h);
		if(agent.chrome || agent.opera || agent.android)
			img = img.toFormat(sharp.format.webp);
		return img.toBuffer();
	}
};
