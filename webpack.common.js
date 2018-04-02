const path = require("path");
require('file-loader');
require('ts-loader');

module.exports = {
	entry: {
		"index": "./src/index.js"
	},
	devtool: "source-map",
	output: {
		filename: "[name].js",
		path: path.resolve(__dirname, "dist")
	},
	resolve: {
		extensions: [".ts", ".js"]
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: [{
					loader: "ts-loader",
					options: {
						transpileOnly: true
					}
				}],
				exclude: [/node_modules/],
			},
			{
				test: /\.(html)$/,
				use: [{
					loader: "file-loader",
					options: {
						context: path.resolve(__dirname, "src"),
						outputPath: "",
						name: "[name].[ext]",
					}
				}]
			},
			{
				test: /\.(json)$/,
				type: "javascript/auto",
				use: [{
					loader: "file-loader",

					options: {
						context: path.resolve(__dirname, "src"),
						outputPath: "",
						name: "[name].[ext]",
					}
				}]
			}]
	}
};