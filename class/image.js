'use strict';
const sharp = require('sharp');
const fileType = require('file-type');
const _ = require('lodash');
const configuration = {
	image: {
		quality: 60,
		compression: 6,
		blur: 0.5
	}
};

module.exports = class ImageManipulation {
	constructor(crop) {
		this.imageOption = {
			progressive: true
		};
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
		//.toFormat(sharp.format.webp)
		return img.toBuffer();
	}
};
