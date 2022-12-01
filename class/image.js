'use strict';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';

const configuration = {
	image: {
		quality: 60,
		blur: {
			min: 0.3,
			max: 0.5
		}
	}
};

export default class ImageManipulation {
	constructor(crop) {
		this.imageOption = {
			progressive: true,
			...crop.imageOption
		};
		this.ext = 'jpeg';
		this.option = {};
		this.webp = crop.webp || true;

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

	async manipulateImage(buffer) {
		const fType = await fileTypeFromBuffer(buffer);
		if(fType)
			this.ext = fType.ext === 'jpg' ? 'jpeg' : fType.ext;

		if(this.ext === 'png') {
			this.imageOption.compressionLevel = Math.round((this.option.q || configuration.image.quality) / 11.11);
		} else {
			this.imageOption.quality = this.option.q || configuration.image.quality;
		}

		let img = sharp(buffer)[this.ext](this.imageOption).blur(this.option.b || configuration.image.blur[this.option.w && this.option.w > 500 ? 'max':'min'])
		if(this.option.w || this.option.h)
			img = img.resize(this.option.w, this.option.h);
		return img.toBuffer();
	}
};
