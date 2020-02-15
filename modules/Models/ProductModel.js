var mongoose = require("mongoose");
Schema = mongoose.Schema;

const ProductsModel = mongoose.model(
	"Products",
	new mongoose.Schema({
		owner: {
			type: String,
			required: true,
			unique: false
		},

		SKU: {
			type: String,
			maxlength: 4,
			minlength: 1,
			required: true
		},
		name: {
			type: String,
			minlength: 2
		},
		quantity: {
			type: Number,
			default: 0
		},
		price: {
			type: Number,
			required: true,
			default: false
		},
		purchased: {
			type: Number,
			required: true,
			default: 0
		},
		description: {
			type: String,
			default: "This is a very strong fruit"
		}
	})
);
module.exports = ProductsModel;