#!/usr/bin/env node
// Sign locally: private upload keys and passwords never need to leave this PC.
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,chmodSync} from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';

if(process.argv.includes('--help')){
 console.log('Usage: node scripts/sign-aab.mjs [unsigned.aab] [signed.aab]\nRequires a JDK (keytool and jarsigner); Android Studio includes one.\nThe prompts can create a new upload key or use your existing upload key.');
 process.exit(0);
}
const input=resolve(process.argv[2]||fileURLToPath(new URL('../releases/Stack-Vechiles-1.1.0-unsigned.aab',import.meta.url)));
const output=resolve(process.argv[3]||join(dirname(input),basename(input).replace(/(?:-unsigned)?\.aab$/i,'-signed.aab')));
if(!existsSync(input)){console.error(`Bundle not found: ${input}`);process.exit(1);}
if(input===output||existsSync(output)){console.error('Choose a new output filename; an existing bundle will not be overwritten.');process.exit(1);}

const extension=process.platform==='win32'?'.exe':'';
const candidates=[
 process.env.JAVA_HOME&&join(process.env.JAVA_HOME,'bin'),
 process.env.ProgramFiles&&join(process.env.ProgramFiles,'Android','Android Studio','jbr','bin'),
 '/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin',
 '',
].filter(value=>value!==undefined);
const bin=candidates.find(dir=>['keytool','jarsigner'].every(name=>spawnSync(dir?join(dir,name+extension):name+extension,['-help'],{stdio:'ignore',windowsHide:true}).status===0));
if(bin===undefined){console.error('Install Android Studio or JDK 21, then set JAVA_HOME to its JDK directory and reopen your terminal.');process.exit(1);}
const tool=name=>bin?join(bin,name+extension):name+extension;
let hidden=false;
const display=new Writable({write(chunk,encoding,done){if(!hidden)process.stdout.write(chunk);done();}});
const prompts=createInterface({input:process.stdin,output:display,terminal:!!process.stdin.isTTY});
const ask=async(message,secret=false)=>{
 if(!secret)return(await prompts.question(message)).trim();
 process.stdout.write(message);hidden=true;
 try{return await prompts.question('');}finally{hidden=false;process.stdout.write('\n');}
};
let storePassword='',keyPassword='';
const run=(name,args,capture=false)=>{
 const result=spawnSync(tool(name),args,{
  stdio:capture?'pipe':'inherit',encoding:'utf8',windowsHide:true,
  env:{...process.env,STACK_VECHILES_STORE_PASSWORD:storePassword,STACK_VECHILES_KEY_PASSWORD:keyPassword},
 });
 if(result.error||result.status!==0)throw new Error(`${name} failed. Check your JDK, keystore path, alias, and passwords.`);
 return(result.stdout||'')+(result.stderr||'');
};
try{
 console.log('Stack Vechiles — local release signing\nKeep your upload keystore and passwords backed up privately.\n');
 const defaultKey=join(homedir(),'.stack-vechiles-signing','upload-keystore.p12');
 const reuseDefault=existsSync(defaultKey);
 if(reuseDefault)console.log(`Existing upload keystore found: ${defaultKey}`);
 const answer=await ask(`Do you already have an upload keystore for this app? ${reuseDefault?'[Y/n]':'[y/N]'}: `);
 const existing=answer?/^y(?:es)?$/i.test(answer):reuseDefault;
 const keystore=resolve((await ask(`${existing?'Existing':'New'} keystore path [${defaultKey}]: `)).replace(/^"|"$/g,'')||defaultKey);
 if(existing&&!existsSync(keystore))throw new Error('The existing keystore was not found.');
 if(!existing&&existsSync(keystore))throw new Error('A keystore already exists there. Run again and choose the existing-key option, or use a different path.');
 const alias=(await ask('Key alias [upload]: '))||'upload';
 if(!/^[a-zA-Z0-9_.-]+$/.test(alias))throw new Error('Use letters, numbers, dots, underscores, or hyphens in the alias.');
 storePassword=await ask('Keystore password (hidden): ',true);
 if(!existing){
  if(storePassword.length<8)throw new Error('Use a password of at least 8 characters.');
  if(storePassword!==await ask('Repeat password (hidden): ',true))throw new Error('The passwords did not match.');
  keyPassword=storePassword;
  mkdirSync(dirname(keystore),{recursive:true,mode:0o700});
  run('keytool',['-genkeypair','-noprompt','-storetype','PKCS12','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Stack Vechiles Upload','-keystore',keystore,'-alias',alias,'-storepass:env','STACK_VECHILES_STORE_PASSWORD','-keypass:env','STACK_VECHILES_KEY_PASSWORD']);
  chmodSync(keystore,0o600);
 }else keyPassword=(await ask('Key password (hidden; Enter if same as keystore password): ',true))||storePassword;
 mkdirSync(dirname(output),{recursive:true});
 run('jarsigner',['-keystore',keystore,'-storepass:env','STACK_VECHILES_STORE_PASSWORD','-keypass:env','STACK_VECHILES_KEY_PASSWORD','-digestalg','SHA-256','-signedjar',output,input,alias]);
 const verification=run('jarsigner',['-J-Duser.language=en','-J-Duser.country=US','-verify',output],true);
 if(!/jar verified\./i.test(verification))throw new Error('The output signature could not be verified. Do not upload this file.');
 console.log(`\nSignature verified.\nSigned bundle: ${output}\nPrivate upload keystore: ${keystore}\nKey alias: ${alias}\n\nUpload the signed .aab to Play Console Internal testing first.\nKeep the keystore and passwords; future updates must use the registered upload key.\nCheck Play Console requirements before production: this bundle targets Android API 35.`);
}catch(error){
 console.error(`\n${error.message}`);process.exitCode=1;
}finally{
 storePassword='';keyPassword='';hidden=false;prompts.close();
}
