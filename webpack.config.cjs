const path = require("path")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const HtmlWebpackPlugin = require("html-webpack-plugin")
const { EsbuildPlugin } = require("esbuild-loader")

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production"

  return {
    entry: "./src/main.tsx",
    devtool: isProduction ? false : "eval-cheap-module-source-map",
    cache: { type: "filesystem" },
    output: {
      filename: isProduction ? "[name].[contenthash].js" : "[name].js",
      chunkFilename: isProduction ? "[name].[contenthash].js" : "[name].js",
      path: path.join(__dirname, "dist"),
      publicPath: "/",
      clean: true,
    },
    module: {
      rules: [
        { test: /\.svg$/, type: "asset/source" },
        { test: /\.(jpe?g|png|gif|ico|woff2?|ttf|eot)$/, type: "asset/resource" },
        {
          test: /\.tsx?$/,
          loader: "esbuild-loader",
          options: { loader: "tsx", target: "es2020" },
        },
        {
          test: /\.s?css$/,
          use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"],
        },
      ],
    },
    resolve: {
      alias: { "@root": path.resolve(__dirname, "src") },
      extensions: [".tsx", ".ts", ".js"],
    },
    optimization: {
      minimizer: [new EsbuildPlugin({ target: "es2020", css: true })],
    },
    performance: { hints: false },
    plugins: [
      new MiniCssExtractPlugin({
        filename: isProduction ? "[name].[contenthash].css" : "[name].css",
      }),
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, "index.html"),
        favicon: path.resolve(__dirname, "src/assets/favicon.ico"),
        scriptLoading: "defer",
      }),
    ],
    devServer: {
      port: 3000,
      open: "/",
      hot: false,
      historyApiFallback: true,
      // Uncomment to proxy API calls to the .NET backend.
      // proxy: [{ context: ["/api"], target: "https://localhost:5001", secure: false }],
    },
  }
}
