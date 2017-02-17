const sharp = require('sharp');
const fileType = require('file-type');
const _ = require('lodash');
const configuration = {
	image: {
		quality: 60,
		blur: {
			min: 0.3,
			max: 0.5
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
			const option = crop.option.replace(/^,|,$|\s+/g, '');
			option.split(',').forEach((v) => {
				const temp = v.split('_');
				if(temp.length === 2)
					this.option[temp[0]] = isNaN(temp[1]) ? temp[1] : Number(temp[1]);
			});
		}
	}

	manipulateImage(buffer) {
		const fType = fileType(buffer);
		if(fType)
			this.ext = fType.ext === 'jpg' ? 'jpeg' : fType.ext;

		_.assignIn(this.imageOption, this.ext === 'png' ? {
			compressionLevel: Math.round((this.option.q || configuration.image.quality) / 11.11)
		} : {
			quality: this.option.q || configuration.image.quality
		});

		let img = sharp(buffer)[this.ext](this.imageOption)
			.blur(this.option.b ||
						(this.option.w && this.option.w > 500) ?
						configuration.image.blur.max : configuration.image.blur.min);
		if(this.option.w || this.option.h)
			img = img.resize(this.option.w, this.option.h);
		return img.toBuffer();
	}
};
