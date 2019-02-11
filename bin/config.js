const fs = require('fs');
const glob = require('glob');
const path = require('path');
const webpackMerge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const logger = require('./logger');

const babelBuilder = require('./builders/babel');
const eslintBuilder = require('./builders/eslint');
const vueBuilder = require('./builders/vue');
const styleBuilder = require('./builders/style');

module.exports = {
  init(args, env) {
    this.args = args;
    this.env = env;

    const config = webpackMerge(
      this.getBaseConfig(),
      this.getEntryConfig(),
      this.getBuilderConfig()
    );

    return config;
  },

  /**
   * Defines the base configuration for Webpack.
   */
  getBaseConfig() {
    const baseConfig = {
      mode: this.env.PLAINS_ENVIRONMENT,
      output: {
        path: this.env.PLAINS_DIST,
        publicPath: '/',
      },
      devServer: {
        contentBase: this.env.PLAINS_DIST,
        host: this.env.PLAINS_HOSTNAME,
        port: this.env.PLAINS_PORT,
      },
    };

    return baseConfig;
  },

  /**
   * Defines the entry configuration for Webpack.
   */
  getEntryConfig() {
    const entries = glob.sync(`${this.env.PLAINS_SRC}/templates/*/index.js`);

    const entryConfig = {
      entry: {},
      plugins: [],
    };

    if (entries.length > 0) {
      entries.forEach(entry => {
        const stats = fs.statSync(entry);

        // Skip empty entry files.
        if (!stats.size) {
          return;
        }

        // Strip out the extension before defining the entry key.
        const extension = path.extname(entry);

        // Define the entry key for the current Webpack entry file.
        const name = entry.replace(`${this.env.PLAINS_SRC}/`, '').replace(extension, '');

        // Define the path of the optional json file for the current template.
        const jsonPath = entry.replace(extension, '.json');

        const defaults = {
          filename: `${name}.html`,
        };

        /**
         * Defines the options from the optional json file located within current
         * template directory.
         */
        const options = Object.assign(defaults, this.getTemplateData(jsonPath));

        // Bundles the current entry file with a static HTML template.
        const page = new HtmlWebpackPlugin(options);

        // Define the name of the initial entry file.
        entryConfig.entry[name] = [entry];

        // Enable WDS for the current file.
        if (this.env.PLAINS_ENVIRONMENT === 'development' && this.args.serve) {
          const address = `http://${this.env.PLAINS_HOSTNAME}:${this.env.PLAINS_PORT}`;

          entryConfig.entry[name].unshift(`webpack-dev-server/client?${address}`);
        }

        // Queue the current entry for Webpack.
        entryConfig.plugins.push(page);
      });
    }

    // Return all queued entry files.
    return entryConfig;
  },

  /**
   * Define the aditional data the current template.
   *
   * @param {String} jsonPath The path to the defined json file from the given entry.
   */
  getTemplateData(jsonPath) {
    let data = {};

    if (fs.existsSync(jsonPath) && fs.statSync(jsonPath).size) {
      try {
        const file = fs.readFileSync(jsonPath, 'utf8');

        data = JSON.parse(file);
      } catch (error) {
        logger.warning(`The optional json file at '${jsonPath}' is not valid and will be ignored.`);
      }
    }

    return data;
  },

  /**
   * Include the required plugins & loaders for basic Webpack asset preprocessing.
   */
  getBuilderConfig() {
    const builderConfig = webpackMerge(babelBuilder, eslintBuilder, vueBuilder, styleBuilder);

    return builderConfig;
  },
};
