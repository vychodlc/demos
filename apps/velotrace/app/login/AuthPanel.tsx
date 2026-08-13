'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPanel() {
  const router = useRouter(); const [registering,setRegistering]=useState(false); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); const form=new FormData(event.currentTarget);
    const body={email:form.get('email'),password:form.get('password'),displayName:form.get('displayName')};
    try { const response=await fetch(`/api/auth/${registering?'register':'login'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const payload=await response.json(); if(!response.ok) throw new Error(payload.error); router.push('/'); router.refresh(); }
    catch(error){setError(error instanceof Error?error.message:'请求失败');} finally{setBusy(false);}
  }
  return <form className="auth-form" onSubmit={submit}>
    <div><p className="eyebrow">{registering?'START YOUR TRACE':'WELCOME BACK'}</p><h1>{registering?'从第一公里开始。':'继续你的路。'}</h1></div>
    {registering&&<label>骑手昵称<input name="displayName" required maxLength={40} placeholder="夜风骑手" /></label>}
    <label>邮箱<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
    <label>密码<input name="password" type="password" autoComplete={registering?'new-password':'current-password'} required minLength={8} placeholder="至少 8 位" /></label>
    {error&&<p className="auth-error">{error}</p>}
    <button className="button primary wide" disabled={busy}>{busy?'请稍候…':registering?'创建账户':'登录'}</button>
    <button className="auth-switch" type="button" onClick={()=>{setRegistering(!registering);setError('')}}>{registering?'已有账户？登录':'第一次来？创建账户'} →</button>
  </form>;
}
