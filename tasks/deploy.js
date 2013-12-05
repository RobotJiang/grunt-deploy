/*
 * grunt-deploy
 * http://zhefeng.github.io/grunt-deploy/
 *
 * Copyright (c) 2013 Zhe Feng
 * Licensed under the MIT license.
 */

 'use strict';

 module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('deploy', 'Your task description goes here.', function() {
    var self = this;
    var done = self.async();
    var Connection = require('ssh2');
    var moment = require('moment');
    var timeStamp = moment().format('YYYYMMDDHHmmssSSS');

    var options = self.options();

    var connections = [];

    var execSingleServer = function(server, connection){

      var exec = function(cmd, showLog, next){

        //console.log(server.username + "@" + server.host + ":~$ " + cmd);
        connection.exec(cmd, function(err, stream) {
          if (err) {throw err;}
          stream.on('data', function(data, extended) {
            showLog && console.log(data + '');
          });
          stream.on('end', function() {
            next && next();
          });
        });
      };

      var execCmds = function(cmds, index, showLog, next){
        if(!cmds ||  cmds.length <= index) {
          next && next();
        }
        else{
          exec(cmds[index++], showLog, function(){
            execCmds(cmds,index,true,next);
          })
        }
      }

      console.log('executing cmds before deploy');

      execCmds(options.cmds_before_deploy, 0, true, function(){

        console.log('cmds before deploy executed');

				//prepare folder
				var prepareFolder = 'mkdir -p '+ options.deploy_path + '/node_modules && mkdir -p '+ options.deploy_path + '/releases ';// && mkdir -p '+ options.deploy_path + '/current '
        var create_new_release_Folder = 'cd ' + options.deploy_path + '/releases && mkdir ' + timeStamp;

        var removeCurrent = 'rm -rf ' + options.deploy_path + '/current';

        var setCurrent = 'ln -s ' + options.deploy_path + '/releases/' + timeStamp + ' ' + options.deploy_path + '/current';

				//set node modules soft link
				var setModules = 'ln -s ' + options.deploy_path + '/node_modules ' +  options.deploy_path + '/current/node_modules';

				//install dependency modules
				var install_dependency = ' cd ' + options.deploy_path + '/current && npm install --production '
        
        console.log('start deploy');

        exec(prepareFolder + ' && ' + create_new_release_Folder + ' && ' + removeCurrent + ' && ' + setCurrent + ' && ' + setModules+ ' && ' + install_dependency, false,function(){

          var sys = require('sys')
          var execLocal = require('child_process').exec;
          var child;
					//use rsync
          child = execLocal("rsync -r --exclude='.*' --exclude='node_modules' . " + server.username + "@" + server.host + ":" + options.deploy_path + "/releases/" + timeStamp, function (error, stdout, stderr) {
            console.log('end deploy');
            console.log('executing cmds after deploy');
            execCmds(options.cmds_after_deploy, 0, true, function(){
              console.log('cmds after deploy executed');
              connection.end();
            });
          });
        })
      })
    }

    var length = options.servers.length;
    var completed = 0;
    var checkCompleted = function(){
      completed++;
      if(completed>=length){
        done();
      }
    }

    options.servers.forEach(function(server){
      var c = new Connection();
      c.on('connect', function() {
        console.log('Connecting to server: ' + server.host);
      });
      c.on('ready', function() {
        console.log('Connected to server: ' + server.host);
        execSingleServer(server,c);
      });
      c.on('error', function(err) {
        console.log("Error on server: " + server.host)
        console.error(err);
        if (err) {throw err;}
      });
      c.on('close', function(had_error) {
        console.log("Closed connection for server: " + server.host);
        checkCompleted();
      });
      c.connect(server);
    })




  });

};

