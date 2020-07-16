#!/usr/bin/env node

/*
 * Copyright (c) 2020. Taimos GmbH http://www.taimos.de
 */

"use strict";

const fs = require('fs');
const yaml = require('js-yaml');

const AWS = require('aws-sdk');
if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  try {
    var agent = require('proxy-agent');
    AWS.config.update({
      httpOptions: {
        agent: agent(process.env.HTTPS_PROXY || process.env.https_proxy)
      }
    });
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.error('Install proxy-agent for proxy support.');
    }
    else {
      throw e;
    }
  }
}

async function getCfnExport(client, name) {
  let next;
  do {
    const res = await client.listExports({ NextToken: next }).promise();
    for (let i = 0; i < res.Exports.length; i++) {
      const ex = res.Exports[i];
      if (ex.Name === name) {
        return ex.Value;
      }
    }
    next = res.NextToken;
  } while (next);
  throw 'Invalid CFN Export';
}

async function getCfnOutput(client, stack, name) {
  const res = await client.describeStacks({StackName: stack}).promise();
  for (let i = 0; i < res.Stacks[0].Outputs.length; i++) {
    const ex = res.Stacks[0].Outputs[i];
    if (ex.OutputKey === name) {
      return ex.OutputValue;
    }
  }
}

async function getSSMParameter(client, name) {
  const res = await client.getParameter({Name: name, WithDecryption: true}).promise();
  return res.Parameter.Value;
}

async function getSecret(client, name, field) {
  const res = await client.getSecretValue({SecretId: name}).promise();
  if (!field) {
    return res.SecretString;
  }
  return JSON.parse(res.SecretString)[field];
}


async function loadVariables(config) {
  const cfn = new AWS.CloudFormation();
  const ssm = new AWS.SSM();
  const sm = new AWS.SecretsManager();
  const vars = [];
  for (const cfg of config) {
    const name = cfg.key;
    let value;
    switch (cfg.type) {
      case 'export':
        value = await getCfnExport(cfn, cfg.name);
        break;
      case 'output':
        value = await getCfnOutput(cfn, cfg.stack, cfg.name);
        break;
      case 'ssm':
        value = await getSSMParameter(ssm, cfg.name);
        break;
      case 'secret':
        value = await getSecret(sm, cfg.name, cfg.field);
        break;
      default:
        console.log(`Load ${cfg}`);
        break;
    }
    vars.push({ name, value});
  }
  return vars;
}

function printVariables(vars) {
  for (const v of vars) {
    console.log(`export ${v.name}="${v.value}"`);
  }
}

function readConfigFile() {
  const doc = yaml.safeLoad(fs.readFileSync('.awsenv', 'utf8'));
  const config = [];
  for (const key in doc.variables) {
    if (doc.variables.hasOwnProperty(key)) {
      const val = doc.variables[key];
      const cfg = { key };
  
      if (val.startsWith('cfn:export:')) {
        cfg.type = 'export';
        cfg.name = val.substr('cfn:export:'.length);
      } else if (val.startsWith('cfn:output:')) {
        cfg.type = 'output';
        const cfgPart = val.substr('cfn:output:'.length).split(':');
        cfg.stack = cfgPart[0];
        cfg.name = cfgPart[1];
      } else if (val.startsWith('ssm:')) {
        cfg.type = 'ssm';
        cfg.name = val.substr('ssm:'.length);
      } else if (val.startsWith('secret:')) {
        cfg.type = 'secret';
        const cfgPart = val.substr('secret:'.length).split(':');
        cfg.name = cfgPart[0];
        cfg.field = cfgPart[1];
      } else {
        console.log(`Invalid config: ${key} - ${val}`);
      }
      config.push(cfg);
    }
  }
  return config;
}

(async () => {
  try {
    const config = readConfigFile();
    const vars = await loadVariables(config);
    printVariables(vars);
  } catch (e) {
    console.error(e);
  }
})()
