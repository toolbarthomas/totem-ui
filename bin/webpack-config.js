const HtmlWebpackPlugin = require('html-webpack-plugin');

const fs = require('fs');
const glob = require('glob');
const path = require('path');
const webpackMerge = require('webpack-merge');

const config = require('./environment-config').init();
const message = require('./message');

module.exports = {
  /**
   * Set the configuration for Webpack based on the defined environment.
   * Configuration should be defined for each environment by creating an
   * environment specific config file. The suffix of the filename must be the
   * same as the given environment value, for example:
   *
   * `webpack.config.development` should be created if `PLAINS_ENVIRONMENT`
   * is set to `development`.
   */
  init() {
    const webpackConfigPath = path.resolve(process.cwd(), 'webpack.config.js');
    let webpackConfig = {};

    // Use the defined default configuration of Webpack as base configuration.
    if (fs.existsSync(webpackConfigPath)) {
      // eslint-disable-next-line
      webpackConfig = require(webpackConfigPath);
    }

    // Define all configuration for the defined Plains environment.
    const environmentConfig = this.getEnvironmentConfig();

    // Define the configuration for each entry file defined within the `templates` directory.
    const entryConfig = this.getEntryConfig();

    // Return the merged Webpack configuration.
    return webpackMerge(webpackConfig, environmentConfig, entryConfig);
  },

  /**
   * Use the Webpack configuration file if `PLAINS_ENVIRONMENT` constant is defined.
   * Webpack will try to load: `webpack.config.${PLAINS_ENVIRONMENT}.js if it exists.
   */
  getEnvironmentConfig() {
    const environmentConfigPath = path.resolve(
      process.cwd(),
      `webpack.config.${config.PLAINS_ENVIRONMENT}.js`
    );

    // Check if the webpack configuration exists for the defined PLAINS_ENVIRONMENT.
    if (!fs.existsSync(environmentConfigPath)) {
      message.warning(
        `The webpack configuration file for "${config.PLAINS_ENVIRONMENT}" could not been found.`
      );

      message.warning(
        `Webpack will ignore the specific configuration for "${config.PLAINS_ENVIRONMENT}".`
      );

      message.warning(
        `Be sure to create a Webpack configuration specific for "${config.PLAINS_ENVIRONMENT}".`
      );

      return {};
    }

    // eslint-disable-next-line
    const environmentConfig = require(environmentConfigPath);

    /**
     * Check if the existing configuration is a valid Javascript Object.
     * Ouput a warning if the configuration file is invalid.
     */
    if (!(environmentConfig instanceof Object) || environmentConfig.constructor !== Object) {
      message.warning(
        `The defined configuration for "${config.PLAINS_ENVIRONMENT}"
        is not a valid configuration object for Webpack.`
      );

      message.warning(
        `Webpack will ignore the specific configuration for "${config.PLAINS_ENVIRONMENT}".`
      );

      return {};
    }

    return environmentConfig;
  },

  /**
   * Define one or more entry files for Webpack, each entry file is defined as
   * a subdirectory within the `templates` directory in the `PLAINS_SRC` directory.
   */
  getEntryConfig() {
    const entries = glob.sync(`${config.PLAINS_SRC}/templates/*/index.js`);

    const templateConfig = {
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
        const name = entry.replace(`${config.PLAINS_SRC}/`, '').replace(extension, '');

        // Define the path of the optional json file for the current template.
        const jsonPath = entry.replace(extension, '.json');

        const defaults = {
          filename: `${name}.html`,
        };

        /**
         * Defines the options from the optional json file located within current
         * template directory.
         */
        const options = Object.assign(defaults, this.getTemplateOptions(jsonPath));

        // Create a new HtmlWebpack plugin to create a html file.
        const page = new HtmlWebpackPlugin(options);

        // Queue the current entry file
        templateConfig.entry[name] = [entry];

        // Include HMR middleware for development environments.
        if (
          config.PLAINS_ENVIRONMENT === 'development' &&
          this.getEnvironmentConfig().devServer instanceof Object
        ) {
          templateConfig.entry[name].unshift(
            `webpack-dev-server/client?${config.PLAINS_SERVER_ADDRESS}`
          );
        }

        // Queue the current entry file for Webpack.
        templateConfig.plugins.push(page);
      });
    }

    // Return all entry files.
    return templateConfig;
  },

  /**
   * Define any options that are defined for the current template.
   *
   * @param {String} jsonPath The path to the defined json file from the given entry.
   */
  getTemplateOptions(jsonPath) {
    let options = {};

    if (fs.existsSync(jsonPath) && fs.statSync(jsonPath).size) {
      try {
        const file = fs.readFileSync(jsonPath, 'utf8');

        options = JSON.parse(file);
      } catch (error) {
        message.warning(
          `The optional json file at '${jsonPath}' is not valid and will be ignored.`
        );
      }
    }

    return options;
  },
};
