'use strict';
const sharp = require('sharp');
const fileType = require('file-type');
const _ = require('lodash');
const configuration = {
	image: {
		quality: {
			default: 60,
			low: 30,
			high: 82
		},
		compression: {
			default: 6,
			low: 9,
			high: 3
		}
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
				this.option[temp[0]] = temp[1];
			});
		}
	}

	manipulateImage(buffer) {
		let fType = fileType(buffer);
		if(fType)
			this.ext = fType.ext === 'jpg' ? 'jpeg' : fType.ext;

		_.assignIn(this.imageOption, this.ext === 'png' ? {
			compressionLevel: configuration.image.compression.default
		}:{
			quality: configuration.image.quality.default
		});
		return sharp(buffer)[this.ext](this.imageOption)
			//.toFormat(sharp.format.webp)
			.toBuffer();
	}
};
