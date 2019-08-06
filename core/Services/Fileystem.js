const { existsSync, writeFileSync } = require('fs');
const { sync } = require('glob');
const { dirname, extname, parse, relative, resolve, sep } = require('path');
const mkdirp = require('mkdirp');
const { error, log } = require('../Utils/Logger');

/**
 * Utitlty to define and retreive the entry paths for the actual workers
 */
class Filesystem {
  constructor() {
    this.stacks = new Map();
    this.src = false;
    this.dist = false;
  }

  /**
   * Defines the root path for the FileSystem that will be used as working directory
   * in order to resolve entry files.
   * An exception will be thrown if the root path does not exists.
   *
   * @param {String} path The actual root path that will be used.
   */
  defineRoot(path) {
    if (!existsSync(path)) {
      error(`The given root path does not exists for: ${path}`);
    }

    this.src = resolve(path);
  }

  /**
   * Defines the destination where the files will be written by the Filesystem.
   */
  defineDestination(path) {
    this.dist = resolve(path);
  }

  /**
   * Returns the root path where all entry files should be stored.
   *
   * @returns {String} Returns the root path of the application.
   */
  getRoot() {
    if (!this.src) {
      error(`No root path has been defined for the Filesystem.`);
    }

    return this.src;
  }

  /**
   * Returns an Array with all subsribed paths within each stack or a specific
   * stack if the stack paramater matches within the stacks object.
   *
   * @param {String|Array} stack Returns the specified stack if it exists.
   */
  source(stack) {
    let map = [];

    if (stack && this.hasStack(stack)) {
      const entries = this.stacks.get(stack);

      entries.forEach(entry => {
        map = map.filter(item => entry !== item).concat(entry);
      });
    } else {
      this.stacks.forEach(entries => {
        entries.forEach(entry => {
          map = map.filter(item => entry !== item).concat(entry);
        });
      });
    }

    return map.filter(item => existsSync(item));
  }

  /**
   * Check if the stack if defined.
   *
   * @param {String} stack The stack to check for existance.
   */
  hasStack(stack) {
    return stack && this.stacks.has(stack);
  }

  /**
   * Creates the defined stack if it hasn't been created yet.
   *
   * @param {String} stack The name of the stack to create.
   */
  createStack(stack) {
    if (this.hasStack(stack)) {
      return;
    }

    this.stacks.set(stack, []);
  }

  /**
   * Inserts a new entry into the given stack.
   *
   * @param {String} stack The name of the stack to insert defined the entry.
   * @param {String} entries The defined entry paths.
   *
   * @returns {Array|Boolean} Returns the entries of the updated stack or false
   * if the actual stack has not been updated.
   */
  insertEntry(stack, entries) {
    if (!this.hasStack(stack)) {
      return false;
    }

    // Make sure the paths are within an Array before it will be resolved.
    const entryPaths = [];

    if (Array.isArray(entries)) {
      entries.forEach(entry => {
        entryPaths.push(entry);
      });
    } else {
      entryPaths.push(entries);
    }

    // Resolve the new entries before it will be inserted within the
    let resolvedPaths = [];
    entryPaths.forEach(path => {
      let initialPath = path;
      const relativePath = relative(process.cwd(), path);
      const relativeSrc = relative(process.cwd(), this.src);

      // Remove the defined root path if it exists within the given entry.
      if (relativePath.indexOf(relativeSrc) === 0) {
        initialPath = relativePath.replace(relativeSrc, '').replace(sep, '');
      }

      if (path.indexOf('*') >= 0) {
        resolvedPaths = resolvedPaths.concat(sync(resolve(this.src, initialPath)).map(globPath => resolve(globPath)));
      } else {
        resolvedPaths = resolvedPaths.concat(resolve(this.src, initialPath));
      }
    });

    // Get the defined stack in order to merge the given entries.
    const initialStack = this.stacks.get(stack);

    // Make sure only new entries are inserted within the stack.
    const transformedStack = resolvedPaths
      .filter(path => path !== initialStack[path] && existsSync(path))
      .concat(initialStack);

    // Update the stack with the new paths.
    if (transformedStack.length > 0) {
      this.stacks.set(stack, transformedStack);

      // Return the updated stack if the stack has been updated.
      return this.source(stack);
    }

    // Return false if the defined stack has not been updated.
    return false;
  }

  /**
   * Writes the defined data to the common destination directory.
   * The destination directory should be defined when creating a new instance of
   * the Filesystem.
   *
   * @param {String} entry The path of the actual data source.
   * @param {Buffer} data The data source as Buffer.
   * @param {Object} options The options
   */
  write(entry, data, options) {
    if (!this.dist) {
      error(`Unable to write, there is no destination defined for the Filesystem service`);
    }

    let relativeEntry = relative(this.src, entry);

    if (options && options.extname) {
      relativeEntry = relativeEntry.replace(extname(relativeEntry).replace('.', ''), options.extname);
    }

    const destination = resolve(this.dist, relativeEntry);

    mkdirp(dirname(destination), (err) => {
      if (err) {
        error(err);
      }

      writeFileSync(destination, data);
    });

    log(`Resource created: ${destination}`);
  }
}

module.exports = Filesystem;
