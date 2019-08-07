const { render } = require('node-sass');
const globImporter = require('node-sass-glob-importer');
const { info } = require('../Utils/Logger');

class SassCompiler {
  constructor(services) {
    this.services = services;
    this.taskName = 'sass';

    // @TODO use default object for worker to validate the actual worker configuration.
    this.defaults = {
      entry: []
    }
  }

  mount() {
    // Get the specific sassCompiler configuraiton that has been defined
    // by the ConfigManager service.
    this.config = this.services.Store.get('plains', 'workers')['sassCompiler'] || {};

    // Create a new Filesystem stack to define the sass entry files.
    this.services.Filesystem.createStack('sassCompiler');

    // Defines the actual Sass entry files that are defined within the configuration.
    // @TODO include support for config entries
    this.services.Filesystem.insertEntry('sassCompiler', this.config.entry);

    // Expose the SassCompiler worker task.
    this.services.Contractor.subscribe(this.taskName, this.init.bind(this), true);
  }

  /**
   * Run the Sasscompiler!
   */
  async init() {
    // Get the defined entry file.
    // @todo check if there is an entry file defined within the wachter queue.
    const entries = this.services.Filesystem.source('sassCompiler');

    // Process each entry in parallel order.
    const compiler = entries.map(async (entry) => {
      await this.processEntry(entry);
    });

    // Wait for each processes.
    await Promise.all(compiler);

    this.services.Contractor.resolve(this.taskName);
  }

  /**
   * Process the defined Sass entry file.
   *
   * @param {String} entry The path of the current entry that will be processed.
   */
  processEntry(entry) {
    return new Promise(cb => {
      info(`Compiling entry: ${entry}`);

      render({
        file: entry,
      }, async (error, chunk) => {

        await this.services.Filesystem.write(entry, chunk.css, {
          extname: 'css'
        });

        // Resolve the Promise for the current entry after it has been written
        // to the filesystem.
        cb();
      });
    });
  }
}

module.exports = SassCompiler;
