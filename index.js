var q = require('q'),
  path = require('path'),
  glob = require('glob'),
  assign = require('object-assign'),
  debug = require('debug')('protractor-cucumber-framework'),
  Cucumber = require('cucumber'),
  state = require('./lib/runState');

/**
 * Execute the Runner's test cases through Cucumber.
 *
 * @param {Runner} runner The current Protractor Runner.
 * @param {Array} specs Array of Directory Path Strings.
 * @return {q.Promise} Promise resolved with the test results
 */
exports.run = function(runner, specs) {
  var results = {};

  return runner.runTestPreparer().then(function() {
    var config = runner.getConfig();
    var opts = assign({}, config.cucumberOpts, config.capabilities.cucumberOpts);
    state.initialize(runner, results, opts.strict);

    return q.promise(function(resolve, reject) {
      var cliArguments = convertOptionsToCliArguments(opts);
      cliArguments.push('--require', path.resolve(__dirname, 'lib', 'resultsCapturer.js'));
      opts.require = convertRequireOptionValuesToCliValues(opts.require);
      opts.require.push(path.resolve(__dirname, 'lib', 'resultsCapturer.js'));
      opts.tags = opts.tags ? [opts.tags] : [] // settings tags manually for now this is expected to be an array
      opts.version = '1.2.0';
      opts.name = [];
      opts.dryRun = undefined;
      opts.failFast = undefined;
      opts.profile = [];
      opts.colors = true;
      opts.compiler = [];
      opts.snippetSyntax = undefined;
      opts.strict = undefined;

      debug('cucumber command: "' + cliArguments.join(' ') + '"');
      var cucumberConf = Cucumber.Cli.Configuration(opts, specs);
      var runtime = Cucumber.Runtime(cucumberConf);
      var formatters = cucumberConf.getFormatters();
      formatters.forEach(function (formatter) {
        runtime.attachListener(formatter);
      });

      this.global.runtime = runtime;
      runtime.start(function(isSuccessful) {
        try {
          var complete = q();
          if (runner.getConfig().onComplete) {
            complete = q(runner.getConfig().onComplete());
          }
          complete.then(function() {
            resolve(results);
          });
        } catch (err) {
          reject(err);
        }
      });

      // Cucumber.Cli(cliArguments).run(function(isSuccessful) {
      //   try {
      //     var complete = q();
      //     if (runner.getConfig().onComplete) {
      //       complete = q(runner.getConfig().onComplete());
      //     }
      //     complete.then(function() {
      //       resolve(results);
      //     });
      //   } catch (err) {
      //     reject(err);
      //   }
      // });
    });
  });

  function convertOptionsToCliArguments(options) {
    var cliArguments = ['node', 'cucumberjs'];

    for (var option in options) {
      var cliArgumentValues = convertOptionValueToCliValues(option, options[option]);

      if (Array.isArray(cliArgumentValues)) {
        cliArgumentValues.forEach(function(value) {
          cliArguments.push('--' + option, value);
        });
      } else if (cliArgumentValues) {
        cliArguments.push('--' + option);
      }
    }
    return cliArguments;
  }

  function convertRequireOptionValuesToCliValues(values) {
    var configDir = runner.getConfig().configDir;

    return toArray(values).map(function(path) {
      // Handle glob matching
      return glob.sync(path, {
        cwd: configDir
      });
    }).reduce(function(opts, globPaths) {
      // Combine paths into flattened array
      return opts.concat(globPaths);
    }, []).map(function(requirePath) {
      // Resolve require absolute path
      return path.resolve(configDir, requirePath);
    }).filter(function(item, pos, orig) {
      // Make sure requires are unique
      return orig.indexOf(item) == pos;
    });
  }

  function convertGenericOptionValuesToCliValues(values) {
    if (values === true || !values) {
      return values;
    } else {
      return toArray(values);
    }
  }

  function convertOptionValueToCliValues(option, values) {
    if (option === 'require') {
      return convertRequireOptionValuesToCliValues(values);
    } else {
      return convertGenericOptionValuesToCliValues(values);
    }
  }

  function toArray(values) {
    return Array.isArray(values) ? values : [values];
  }
}