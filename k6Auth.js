import http from 'k6/http';
import { check } from 'k6';
import {
  AWSConfig,
  Endpoint,
  SignatureV4,
} from 'https://jslib.k6.io/aws/0.12.3/signature.js';

/*
    Structure for JSON format:
    Found in structuredExample.json
*/

// Code to run file:
// export $(grep -v '^#' .env | xargs) && k6 run k6Auth.js

// Comment out if multiple requests are not required
// export let options = {
//     vus: 10,       // Run exactly 10 users
//     iterations: 10 // Each user runs only once
// };


// Setup configs
const awsConfig = new AWSConfig({
    region: __ENV.AWS_REGION,
    accessKeyId: __ENV.AWS_ACCESS_KEY,
    secretAccessKey: __ENV.AWS_SECRET_KEY,
});

// open data
const data = open('./unstructured_neighborhood_full_input.json');


export default function () {
    /* In order to be able to sign an HTTP request's, we need to instantiate a SignatureV4 object*/
    const signer = new SignatureV4({
        //service, region, credentials
        service: 'api-gateway',
        region: awsConfig.region,
        credentials: {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
        },
        uriEscapePath: false,
        applyChecksum: true,
    });

    //create our signed http request to post to our api
    const signedRequest = signer.sign({
        method: 'POST',
        endpoint: new Endpoint(__ENV.AWS_ENDPOINT),
        path: __ENV.AWS_PATH || '/',
        headers: { 'Content-Type': 'application/json' },
        body: data
    },
        {
        signingDate: new Date(),
        signingService: 'execute-api',
        signingRegion: awsConfig.region,
        }
    );

    // load our response
    const response = http.post(
                                signedRequest.url, 
                                signedRequest.body, 
                                {
                                headers:signedRequest.headers,
                                timeout: '60s' //default  
                                });
    console.log('Response Status:', response.status);  
    console.log('Response Headers:', response.headers);
    const responseBody = JSON.parse(response.body);
    const structuredData = responseBody.structured_data
    // console.log('Structured Data:', JSON.stringify(structuredData, null, 2));


    // check our response
    check(response, {
        'status is 200': (r) => r.status === 200,
    });
    check(structuredData, {
        'Structured data exists': (data) => Array.isArray(data) && data.length > 0,
        'Each entry has Neighborhood Name': (data) => data.every(entry => entry.hasOwnProperty("Neighborhood Name")),
        'Each entry has Metadata': (data) => data.every(entry => entry.hasOwnProperty("Neighborhood MetaData")),
        'Each entry has House Data': (data) => data.every(entry => entry.hasOwnProperty("House Type"))
    });
}