export function libraryPage(total,requested=0,size=100){
 const pages=Math.max(1,Math.ceil(total/size));
 const page=Math.min(pages-1,Math.max(0,Math.floor(Number(requested)||0)));
 const start=page*size;
 return {page,pages,start,end:Math.min(total,start+size),total};
}
