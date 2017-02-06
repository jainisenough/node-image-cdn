'use strict';
const sharp = require('sharp');
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
		this.option = {};
		if(crop && crop.option) {
			let option = {};
			crop.option.split(',').forEach((k, v) => {
				this.option[k] = v;
			});
		}
	}

	manipulateImage(buffer) {
		let img = sharp(buffer)
			.progressive()
			.quality(configuration.image.quality.default)
			.compressionLevel(configuration.image.compression.default);

		return Promise.all([
			img,
			img.toFormat(sharp.format.webp)
		]);
	}
};

