import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import AuthPanel from './AuthPanel';

export default async function LoginPage() {
  if (await currentUser()) redirect('/');
  return <main className="auth-page">
    <section className="auth-story"><a className="brand" href="/"><span className="brand-mark"><i></i><i></i><i></i></span><span>VELO<span>TRACE</span></span></a><div><p>YOUR RIDES. YOUR STORY.</p><h2>把散落在平台里的骑行，变成一条看得见的生涯。</h2><span className="auth-line"></span></div><small>STRAVA · iGPSPORT · GPX · FIT</small></section>
    <AuthPanel />
  </main>;
}
