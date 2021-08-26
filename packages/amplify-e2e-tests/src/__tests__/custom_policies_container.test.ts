import { 
    initJSProjectWithProfile, 
    deleteProject, 
    getProjectMeta, 
    getCustomPoliciesPath, 
    amplifyPushWithoutCodegen,
    readJsonFile,
    addRestContainerApiForCustomPolicies
  } from 'amplify-e2e-core';
  import { createNewProjectDir, deleteProjectDir } from 'amplify-e2e-core';
  import _ from 'lodash';
  import { JSONUtilities } from 'amplify-cli-core';
  import AWS from 'aws-sdk';
  import path from 'path';
  import { amplifyConfigureProject } from 'amplify-e2e-core';
  
  const customIAMPolicy: CustomIAMPolicy = {
              Effect: 'Allow',
              Action: [
                'ssm:GetParameter'
              ],
              Resource: []
  };
  const customIAMPolicies = {
    policies: []
  }
  
  async function setupAmplifyProject(cwd: string) {
      await amplifyConfigureProject({
        cwd,
        enableContainers: true
      });
    };
  
  describe('nodejs', () => {
      describe('amplify attach custom policies', () => {
          let projRoot: string;
  
      
          beforeEach(async () => {
            projRoot = await createNewProjectDir('testCusomtPolicies');
          });
      
          afterEach(async () => {
            await deleteProject(projRoot);
            deleteProjectDir(projRoot);
          });
  
          it(`should init and deploy a api container, attach custom policies to the Lambda`, async () => {
            const envName = 'devtest';
            const containerName = 'container';
            const name = 'containertest';
            await initJSProjectWithProfile(projRoot, { name: containerName, envName });
            await setupAmplifyProject(projRoot);
            await addRestContainerApiForCustomPolicies(projRoot);
  
            const meta = getProjectMeta(projRoot);
            const { Region: region } = meta?.providers?.awscloudformation;
            
            // Put SSM parameter
            let ssmClient = new AWS.SSM({ region });
            await ssmClient.putParameter({
              Name: 'testCustomPolicies',
              Value: 'testCustomPoliciesValue',
              Type: 'String',
              Overwrite: true,
            }).promise();
  
            const getParaResponse = await ssmClient.getParameter({
              Name: 'testCustomPolicies'
            }).promise();
            var ssmParameterArn = getParaResponse.Parameter.ARN;
            
            customIAMPolicy.Resource.push(ssmParameterArn);
            const customPoliciesPath = getCustomPoliciesPath(projRoot, 'api', name);
            customIAMPolicies.policies.push(customIAMPolicy);
            JSONUtilities.writeJson(customPoliciesPath, customIAMPolicies);
            
            await amplifyPushWithoutCodegen(projRoot);
            const containerCFN = readJsonFile(
              path.join(projRoot, 'amplify', 'backend', 'api', name, `${name}-cloudformation-template.json`),
            );
            
            expect(containerCFN.Resources.CustomExecutionPolicyForContainer.Properties.PolicyDocument.Statement[0])
            .toEqual(customIAMPolicies.policies[0]);
          });
      });
  });
  
  type CustomIAMPolicy = {
    Action: string[];
    Effect: string;
    Resource: string[];
  }
  
  