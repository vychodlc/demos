import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Script from 'next/script';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const source = await readFile(path.join(process.cwd(), 'public', 'index.html'), 'utf8');
  let content = source.match(/<body>([\s\S]*?)<script type="module" src="\/app\.js"><\/script>[\s\S]*?<\/body>/)?.[1] || '';
  content = content
    .replace('<div class="avatar">Y</div>', `<div class="avatar">${user.displayName.slice(0, 1).toUpperCase()}</div>`)
    .replace('<strong>夜风骑手</strong>', `<strong>${user.displayName.replace(/[<>&"']/g, '')}</strong>`)
    .replace('<div class="rider">', '<button class="nav-item" id="logoutButton"><span>↪</span>退出登录</button><div class="rider">');
  return <><div dangerouslySetInnerHTML={{ __html: content }} /><Script src="/app.js" strategy="afterInteractive" /></>;
}
