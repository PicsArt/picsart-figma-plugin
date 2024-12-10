const InlineChunkHtmlPlugin = require("react-dev-utils/InlineChunkHtmlPlugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const path = require("path");
const webpack = require("webpack");

module.exports = (__, argv) => ({
  mode: argv.mode === "production" ? "production" : "development",
  devtool: argv.mode === "production" ? false : "inline-source-map",
  entry: {
    ui: "./src/ui.tsx",
    code: "./src/code.ts",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.svg/,
        type: "asset/inline",
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name][ext]', 
        },
        parser: {
          dataUrlCondition: {
            maxSize: 10
          }
        }
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          "style-loader", 
          {
            loader: "css-loader", 
            options: {
              url: true, 
              sourceMap: argv.mode !== "production",
            },
          },
          {
            loader: "sass-loader",
            options: {
              sourceMap: argv.mode !== "production",
            },
          },
        ],
      },
    ],
  },
  resolve: { extensions: [".tsx", ".ts", ".jsx", ".js", ".scss"],
    alias : {
      "@assets": path.resolve(__dirname, 'assets'),
      "@routes": path.resolve(__dirname, 'routes'),
      "@controllers": path.resolve(__dirname, 'controllers'),
      "@services": path.resolve(__dirname, 'services'),
      "@constants": path.resolve(__dirname, 'constants/'),
      "@styles": path.resolve(__dirname, 'src/styles/'),
      "@utils": path.resolve(__dirname, 'src/utils/'),
      "@components": path.resolve(__dirname, 'src/components/'),
      "@api": path.resolve(__dirname, 'src/api/'),
      "@ui": path.resolve(__dirname, 'src/components/ui/'),
    }
  },
  output: {
    filename: "[name].js",
    clean: true,
    path: path.join(__dirname, "dist"),
    publicPath: '/',
  },
  plugins: [
    new webpack.DefinePlugin({
      global: {},
    }),
    new HtmlWebpackPlugin({
      inject: "body",
      template: "./public/index.html",
      filename: "ui.html",
      chunks: ["ui"],
    }),
    new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/ui/]),
  ],

});