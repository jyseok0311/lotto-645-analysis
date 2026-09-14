// 공용 통계 유틸
export function lnGamma(z){const g=[676.5203681218851,-1259.1392167224028,771.32342877765313,
-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
if(z<0.5) return Math.log(Math.PI/Math.sin(Math.PI*z))-lnGamma(1-z);
z-=1;let x=0.99999999999980993;for(let i=0;i<8;i++)x+=g[i]/(z+i+1);
const t=z+7.5;return 0.5*Math.log(2*Math.PI)+(z+0.5)*Math.log(t)-t+Math.log(x);}
function gser(a,x){let ap=a,sum=1/a,del=sum;for(let n=0;n<1000;n++){ap++;del*=x/ap;sum+=del;
if(Math.abs(del)<Math.abs(sum)*1e-15)break;}return sum*Math.exp(-x+a*Math.log(x)-lnGamma(a));}
function gcf(a,x){const FPMIN=1e-300;let b=x+1-a,c=1/FPMIN,d=1/b,h=d;
for(let i=1;i<1000;i++){const an=-i*(i-a);b+=2;d=an*d+b;if(Math.abs(d)<FPMIN)d=FPMIN;
c=b+an/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;const del=d*c;h*=del;
if(Math.abs(del-1)<1e-15)break;}return Math.exp(-x+a*Math.log(x)-lnGamma(a))*h;}
// 카이제곱 상측 p-value
export function chi2p(chi2,df){const a=df/2,x=chi2/2;if(x<=0)return 1;
return x<a+1?1-gser(a,x):gcf(a,x);}
export function erf(x){const s=x<0?-1:1;x=Math.abs(x);
const t=1/(1+0.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);
return s*y;}
export const normP2 = z => 1-erf(Math.abs(z)/Math.SQRT2);   // 양측 p
export const lnC = (n,k)=> (k<0||k>n)?-Infinity:lnGamma(n+1)-lnGamma(k+1)-lnGamma(n-k+1);
export const C = (n,k)=> Math.exp(lnC(n,k));
export const hyper=(k,N,K,n)=>Math.exp(lnC(K,k)+lnC(N-K,n-k)-lnC(N,n));
export const sum=a=>a.reduce((x,y)=>x+y,0);
export const mean=a=>sum(a)/a.length;
export const sd=a=>{const m=mean(a);return Math.sqrt(sum(a.map(x=>(x-m)**2))/(a.length-1));};
export const fmt=(x,d=2)=>Number(x).toFixed(d);
export const pstr=p=>p<1e-4?p.toExponential(1):p.toFixed(4);
