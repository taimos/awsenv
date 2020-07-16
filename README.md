# awsenv

awsenv is a NodeJS command line tool to populate your Bash environment with values from AWS.

## Installation

To install awsenv open a terminal and issue: `npm install -g awsenv`

## Usage

Create a file called `.awsenv` with content like:

```
variables:
  MY_VPC: cfn:export:VPC-ID
  INFRA_VPC: cfn:export:infra-vpc:ExportsOutputRefVPCB9E5F0B4BD23A326
  DEV_TABLE: cfn:output:my-app-dev:Database
  SERVER_PORT: ssm:/service/prod/server/svc.port
  AZURE_AD_TENANT: secret:AzureAD:TenantId
```

When running `awsenv` in your shell, it will popultae it with additional environment variables with the specified values.

Supported sources are:

* CloudFormation Exports: `cfn:export:<ExportName>`
* CloudFormation Outputs: `cfn:output:<StackName>:<OutputName>`
* SSM Parameters: `ssm:/path/to/parameter`
* Secretsmanager Secrets: `secret:<Name>` or `secret:<Name>:<JsonField>`

Values are resolved using your current AWS credentials

## Contribute

Feel free to open issues, provide code improvements or updates to the documentation.

## License

The script is licensed under the MIT license and provided as-is.
