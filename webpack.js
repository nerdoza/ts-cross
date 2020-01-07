process.env.NODE_ENV = ['production', 'development'].find(t => process.argv.includes(t)) || 'development'
process.env.PLATFORM = ['android', 'ios', 'web', 'windows', 'mac'].find(t => process.argv.includes(t)) || 'web'
process.env.DEPLOYMENT = ['dev', 'run', 'release'].find(t => process.argv.includes(t)) || 'dev'
process.env.PKGNAME = require('./package.json').name
process.env.SEMVER = require('./package.json').version

if (process.env.DEPLOYMENT === 'release') {
  process.env.NODE_ENV = 'production'
}

const webpack = require('webpack')
const path = require('path')
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CspHtmlWebpackPlugin = require('csp-html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const WebpackDevServer = require('webpack-dev-server')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const WriteJsonPlugin = require('write-json-webpack-plugin')
const ElectronBuilder = require("electron-builder")

const PROD = process.env.NODE_ENV === 'production'
const NODE_ENV = process.env.NODE_ENV
const PLATFORM = process.env.PLATFORM
const DEPLOYMENT = process.env.DEPLOYMENT
const ANALYZE = process.argv.includes('analyze')
const PUBLISH = process.argv.includes('publish')
const PKGNAME = process.env.PKGNAME
const SEMVER = process.env.SEMVER
const CORDOVA = PLATFORM === 'android' || PLATFORM === 'ios'
const ELECTRON = PLATFORM === 'windows' || PLATFORM === 'mac'
const EXTERNAL_DEPLOYMENT = CORDOVA
const SRC_DIR = path.join(__dirname, 'src')
const ENTRY_FILE = path.join(SRC_DIR, CORDOVA ? 'cordova' : (ELECTRON ? 'electron' : 'web'), 'index.ts')
const ELECTRON_MAIN_FILE = path.join(SRC_DIR, 'electron', 'main.ts')
const APP_FILE = path.join(SRC_DIR, 'app', 'index.ts')
const ASSET_DIR = path.join(__dirname, 'assets')
const CONST_FILE = path.join(__dirname, 'src', 'constants.ts')
const DIST_DIR = path.join(__dirname, 'dist', PLATFORM, 'www')
const TARGET = ELECTRON ? 'electron-renderer' : 'web'
const ELECTRON_MAIN_OUTPUT = 'main.js'

const getIpAddr = () => {
  const ifaces = require('os').networkInterfaces()
  for (const key in ifaces) {
    if (Object.prototype.hasOwnProperty.call(ifaces, key)) {
      for (const ipInfoKey in ifaces[key]) {
        if (Object.prototype.hasOwnProperty.call(ifaces[key], ipInfoKey)) {
          const ipInfo = ifaces[key][ipInfoKey]
          if (ipInfo.family === 'IPv4' && ipInfo.address.indexOf('192.168.') === 0 && !ipInfo.internal) {
            return ipInfo.address
          }
        }
      }
    }
  }

  return '127.0.0.1'
}

const runCmd = (cmd, onExit) => {
  const { spawn } = require('child_process')
  const cmdSpawn = spawn(cmd, {
    shell: true,
    stdio: [process.stdin, 'pipe', process.stderr]
  })

  cmdSpawn.stdout.on('data', (data) => {
    console.log(data.toString())
  })

  cmdSpawn.on('data', (error) => {
    console.error(error)
  })

  cmdSpawn.on('exit', (code) => {
    if (onExit) {
      onExit(code)
    }
  })
}

console.log('*********************************************')
console.log('* Platform: ' + PLATFORM)
console.log('* Version: ' + SEMVER)
console.log('* Environment: ' + NODE_ENV)
console.log('* Deployment: ' + DEPLOYMENT)
console.log('*********************************************')

const config = {
  performance: {
    hints: false
  },
  devtool: '#source-map',
  mode: NODE_ENV,
  entry: ENTRY_FILE,
  output: {
    filename: 'index.js',
    path: DIST_DIR
    // publicPath: '../'
  },
  resolve: {
    alias: {
      '@const': CONST_FILE,
      '@app': APP_FILE,
      vue$: 'vue/dist/vue.esm.js'
    },
    extensions: ['.ts', '.js', '.vue', '.node', '.json', '.css']
  },
  target: TARGET,
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'vue-style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.scss$/,
        use: [
          'vue-style-loader',
          'css-loader',
          'sass-loader',
          {
            loader: 'sass-resources-loader',
            options: {
              resources: path.resolve(ASSET_DIR, 'scss/includes/*.scss')
            }
          }
        ]
      },
      {
        test: /\.html$/,
        use: 'vue-html-loader'
      },
      {
        test: /\.js$/,
        use: 'babel-loader',
        exclude: file => (/node_modules/.test(file) && !/\.vue\.js/.test(file))
      },
      {
        test: /\.node$/,
        use: 'node-loader'
      },
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules|vue\/src/,
        options: {
          appendTsSuffixTo: [/\.vue$/],
          transpileOnly: true
        }
      },
      {
        test: /\.md$/,
        loader: 'vue-markdown-loader'
      },
      {
        test: /\.vue$/,
        use: {
          loader: 'vue-loader',
          options: {
            extractCSS: PROD,
            loaders: {
              scss: 'vue-style-loader!css-loader!sass-loader'
            }
          }
        }
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        use: {
          loader: 'file-loader',
          options: {
            name: 'images/[name].[ext]'
          }
        }
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
        loader: 'file-loader',
        options: {
          name: 'sounds/[name].[ext]'
        }
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        use: {
          loader: 'file-loader',
          options: {
            name: 'fonts/[name].[ext]'
          }
        }
      }
    ]
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({ tslint: true, vue: true }),
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [CORDOVA && PROD ? path.join(DIST_DIR, '../**/*') : path.join(DIST_DIR, '**/*')]
    }),
    new VueLoaderPlugin(),
    new webpack.EnvironmentPlugin(['NODE_ENV', 'PLATFORM', 'SEMVER']),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.resolve(SRC_DIR, 'index.ejs'),
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true
      },
      environment: {
        env: NODE_ENV,
        platform: PLATFORM
      }
    }),
    new CspHtmlWebpackPlugin(
      {
        'base-uri': "'self'",
        'object-src': "'none'",
        'script-src': ["'self'"],
        'style-src': ["'self'"]
      },
      {
        enabled: true,
        hashingMethod: 'sha256',
        hashEnabled: {
          'script-src': true,
          'style-src': true
        },
        nonceEnabled: {
          'script-src': true,
          'style-src': true
        }
      }
    ),
    new webpack.NoEmitOnErrorsPlugin()
  ]
}

// ------------------------------------
// Electron Main Configuration
// ------------------------------------
const electronMainConfig = {
  performance: {
    hints: false
  },
  devtool: PROD ? '' : '#source-map',
  mode: NODE_ENV,
  entry: ELECTRON_MAIN_FILE,
  output: {
    filename: ELECTRON_MAIN_OUTPUT,
    path: DIST_DIR
  },
  target: 'electron-main',
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          transpileOnly: true
        }
      }
    ]
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({ tslint: true, vue: true }),
    new webpack.EnvironmentPlugin(['NODE_ENV', 'PLATFORM', 'SEMVER']),
    new webpack.NoEmitOnErrorsPlugin()
  ]
}

// ------------------------------------
// Electron Main Compilation Processes
// ------------------------------------
const electronMainCompile = (callback) => {
  const electronCompiler = webpack(electronMainConfig)
  electronCompiler.run((error, stats) => {
    if (error) {
      console.error(error)
      return
    }

    console.log(stats.toString({
      chunks: false,
      colors: true
    }))
  })

  electronCompiler.hooks.done.tap('run_electron_main', (results) => {
    if (results.compilation.errors.length > 0) {
      console.error('ERROR: Electron Main build failed, halting deployment')
      return callback(false)
    }
    callback(true)
  })
}

let electronProcess = null
const startElectronMain = () => {
  const { spawn } = require('child_process')
  const electron = require('electron')

  let queuedData = ''
  const elog = data => {
    const dString = data.toString()
    if (dString.length > 1 && /\r?\n$/.test(dString)) {
      console.log(queuedData + dString)
      queuedData = ''
    } else {
      queuedData += dString
    }
  }

  electronProcess = spawn(electron, ['--inspect=5858', electronMainConfig.output.path])

  electronProcess.stdout.on('data', elog)

  electronProcess.stderr.on('data', elog)

  electronProcess.on('close', () => {
    process.exit()
  })
}

// ------------------------------------
// Cordova Only Configs
// ------------------------------------
if (CORDOVA) {
  const platformRegex = new RegExp(`\\s*<platform name="(?!${PLATFORM}).*">(?:.|[\\r\\n])*</platform>`, 'gm');
  const engineRegex = new RegExp(`\\s*<engine name="(?!${PLATFORM}).*".*/>`, 'gm');

  config.plugins.push(
    new CopyWebpackPlugin([
      {
        from: path.join(__dirname, 'cordova.config.xml'),
        to: path.join(DIST_DIR, '../config.xml'),
        ignore: ['.*'],
        force: true,
        transform (content) {
          return content.toString('utf8')
            .replace(/version="([0-9]+\.?){1,3}"/, 'version = "' + SEMVER + '"')
            .replace(platformRegex, '')
            .replace(engineRegex, '')
        }
      }
    ]),
    new CopyWebpackPlugin([
      {
        from: path.join(__dirname, 'cordova.build.json'),
        to: path.join(DIST_DIR, '../build.json'),
        ignore: ['.*'],
        force: true
      }
    ])
    // new CopyWebpackPlugin([
    //   {
    //     from: path.join(__dirname, 'res/dist'),
    //     to: path.join(DIST_DIR, '../res'),
    //     force: true
    //   }
    // ])
  )
}

// ------------------------------------
// Electron Only Configs
// ------------------------------------
if (ELECTRON) {
  process.env.ELECTRON_RENDERER_URL = `file://${DIST_DIR}/index.html`

  config.output.libraryTarget = 'commonjs2'
  config.plugins.push(
    new WriteJsonPlugin({
      object: {
        name: PKGNAME,
        version: SEMVER,
        main: ELECTRON_MAIN_OUTPUT
      },
      filename: 'package.json',
      pretty: true
    })
  )
}

// ------------------------------------
// Analyze Configs
// ------------------------------------
if (ANALYZE) {
  config.plugins.push(
    new BundleAnalyzerPlugin()
  )
}

// ------------------------------------
// Production Only Configs
// ------------------------------------
if (PROD) {
  config.devtool = ''
  config.plugins.push(
    new MiniCssExtractPlugin({
      filename: 'styles.[hash].css'
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: true
    })
  )

  electronMainConfig.plugins.push(
    new webpack.LoaderOptionsPlugin({
      minimize: true
    })
  )
}

// ------------------------------------
// Dev Only Configs
// ------------------------------------
if (DEPLOYMENT === 'dev') {
  const port = (EXTERNAL_DEPLOYMENT) ? 9001 : 9000
  const address = (EXTERNAL_DEPLOYMENT) ? getIpAddr() : '127.0.0.1'
  const contentBase = (CORDOVA) ? [config.output.path, path.join(DIST_DIR, `../platforms/${PLATFORM}/platform_www`)] : config.output.path

  config.plugins.push(
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin()
  )

  config.entry = {
    web: [
      'webpack-dev-server/client?http://' + address + ':' + port,
      'webpack/hot/dev-server'
    ],
    app: [
      config.entry
    ]
  }

  const compiler = webpack(config)

  const server = new WebpackDevServer(compiler, {
    host: address,
    contentBase,
    stats: { colors: true },
    hot: true,
    writeToDisk: true
  })

  server.listen(port, address, () => {
    console.log('Starting server on http://' + address + ':' + port)
  })

  // ------------------------------------
  // Cordova Dev Only Configs
  // ------------------------------------
  if (CORDOVA) {
    let hasDeployed = false
    compiler.hooks.done.tap(`dev_${PLATFORM}`, (results) => {
      if (hasDeployed) {
        return
      }

      if (results.compilation.errors.length > 0) {
        console.error('ERROR: Build failed, halting deployment')
        return
      }

      hasDeployed = true
      const configPath = path.join(DIST_DIR, '../config.xml')
      const fs = require('fs')
      const et = require('elementtree')
      const src = 'http://' + address + ':' + port + '/index.html'

      try {
        var configXML = new et.ElementTree(
          et.XML(
            fs.readFileSync(configPath, 'utf-8')
          )
        )
        configXML.getroot()._children.forEach(function (el) {
          if (el.tag === 'content') {
            el.attrib.src = src
          }
        })
        fs.writeFileSync(configPath, configXML.write({ indent: 4 }), 'utf-8')
      } catch (err) {
        console.error('ERROR: Could not replace content src in: ' + configPath, err)
        process.exit(1)
      }

      runCmd(`cd dist/${PLATFORM} && npx cordova prepare`, () => {
        runCmd(`cd dist/${PLATFORM} && npx cordova run ${PLATFORM} --buildConfig`)
      })
    })
  }

  // ------------------------------------
  // Electron Dev Only Configs
  // ------------------------------------
  if (ELECTRON) {
    process.env.ELECTRON_RENDERER_URL = 'http://' + address + ':' + port + '/index.html'

    let hasDeployed = false
    compiler.hooks.done.tap(`dev_${PLATFORM}`, results => {
      if (hasDeployed) {
        return
      }

      if (results.compilation.errors.length > 0) {
        console.error('ERROR: Build failed, halting deployment')
        return
      }

      hasDeployed = true
      electronMainCompile(success => {
        if (success) {
          startElectronMain()
        }
      })
    })
  }
}

// ------------------------------------
// Run Only Configs
// ------------------------------------
if (DEPLOYMENT === 'run') {
  const compiler = webpack(config)
  compiler.run((error, stats) => {
    if (error) {
      console.error(error)
      return
    }

    console.log(stats.toString({
      chunks: false,
      colors: true
    }))
  })

  compiler.hooks.done.tap(`run_${PLATFORM}`, (results) => {
    if (results.compilation.errors.length > 0) {
      console.error('ERROR: Build failed, halting deployment')
      return
    }

    if (CORDOVA) {
      const platformDir = path.join(DIST_DIR, '../')
      runCmd(`cd ${platformDir} && npx cordova prepare`, () => {
        runCmd(`cd ${platformDir} && npx cordova run ${PLATFORM} --buildConfig`)
      })
    } else if (PLATFORM === 'web') {
      runCmd(`npx http-server ${DIST_DIR} -p 9000`)
    } else if (ELECTRON) {
      electronMainCompile(success => {
        if (success) {
          startElectronMain()
        }
      })
    }
  })
}

// ------------------------------------
// Release Only Configs
// ------------------------------------
if (DEPLOYMENT === 'release') {
  const compiler = webpack(config)
  compiler.run((error, stats) => {
    if (error) {
      console.error(error)
      return
    }

    console.log(stats.toString({
      chunks: false,
      colors: true
    }))
  })

  compiler.hooks.done.tap(`release_${PLATFORM}`, (results) => {
    if (results.compilation.errors.length > 0) {
      console.error('ERROR: Build failed, halting deployment')
      return
    }

    if (CORDOVA) {
      const platformDir = path.join(DIST_DIR, '../')
      runCmd(`cd ${platformDir} && npx cordova prepare`, () => {
        runCmd(`cd ${platformDir} && npx cordova build ${PLATFORM} --buildConfig --release`)
      })
    } else if (ELECTRON) {
      let electronConfig = require('./electron-builder.json')
      const electronPlatform = PLATFORM === 'windows' ? ElectronBuilder.Platform.WINDOWS.createTarget() : ElectronBuilder.Platform.MAC.createTarget()
      if (!electronConfig.directories) {
        electronConfig.directories = {}
      }
      electronConfig.directories.app = DIST_DIR
      electronConfig.directories.output = path.join(DIST_DIR, '../build')

      electronMainCompile(success => {
        if (success) {
          ElectronBuilder.build({
            targets: electronPlatform,
            config: electronConfig
          }).catch((error) => console.log(error))
        }
      })
    }
  })
}
