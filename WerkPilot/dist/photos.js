export async function preparePhoto(file,options={}){
 if(!file)throw Error('Bitte ein Foto auswählen.');
 const type=file.type||(/\.jpe?g$/i.test(file.name)?'image/jpeg':/\.png$/i.test(file.name)?'image/png':/\.webp$/i.test(file.name)?'image/webp':'');
 if(!['image/jpeg','image/png','image/webp'].includes(type))throw Error('Bitte JPG, PNG oder WebP auswählen. HEIC-Fotos vorher als JPG exportieren.');
 if(file.size>20*1024*1024)throw Error('Bitte ein Foto kleiner als 20 MB auswählen.');
 const createBitmap=options.createBitmap??globalThis.createImageBitmap;
 const makeCanvas=options.makeCanvas??(()=>document.createElement('canvas'));
 const decodeFallback=options.decodeFallback??(input=>new Promise((resolve,reject)=>{
  const image=new Image(),url=URL.createObjectURL(input);
  image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
  image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Das Foto kann nicht gelesen werden. Bitte als JPG erneut auswählen.'))};
  image.src=url;
 }));
 let image;
 try{if(createBitmap)image=await createBitmap(file)}catch{}
 if(!image)image=await decodeFallback(file);
 try{
  const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
  if(!width||!height||width*height>150000000)throw Error('Bildgröße ist ungültig oder zu groß. Bitte das Foto verkleinern.');
  const scale=Math.min(1,1400/Math.max(width,height)),canvas=makeCanvas();
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d');
  if(!context)throw Error('Bildverarbeitung wird auf diesem Gerät nicht unterstützt. Android System WebView aktualisieren.');
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/jpeg',.8);
  if(!data.startsWith('data:image/jpeg;base64,'))throw Error('Das Foto konnte nicht als JPG vorbereitet werden.');
  return {name:String(file.name||'Auftragsfoto.jpg').slice(0,300),data};
 }finally{image.close?.()}
}
