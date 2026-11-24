export const bundles=[
  {id:'stackline_coins_100',coins:100,diamonds:5,inr:29},
  {id:'stackline_coins_200',coins:200,diamonds:10,inr:49},
  {id:'stackline_coins_500',coins:500,diamonds:25,inr:99},
  {id:'stackline_coins_1000',coins:1000,diamonds:60,inr:149},
];

export const allAccessPass={id:"stackline_all_access",inr:699};

export const decodeBase64=encoded=>Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));

export async function verifyPlayBundle(key,purchase){
 const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decodeBase64(purchase.signature),new TextEncoder().encode(purchase.receipt));
 if(!valid)throw Error();
 const receipt=JSON.parse(purchase.receipt);
 const bundle=receipt.productId===allAccessPass.id?allAccessPass:bundles.find(b=>b.id===receipt.productId);
 const quantity=receipt.quantity??1;
 const token=receipt.purchaseToken??receipt.token;
 if((bundle===allAccessPass&&quantity!==1)||!bundle||receipt.packageName!=='com.trishool.stackline'||receipt.purchaseState!==0||
   !token||token!==purchase.purchaseToken||!Number.isSafeInteger(quantity)||quantity<1)throw Error();
 return {bundle,quantity,token};
}
