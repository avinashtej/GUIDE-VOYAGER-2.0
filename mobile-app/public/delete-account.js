const form=document.querySelector('#delete-form');
const message=document.querySelector('#message');
form.addEventListener('submit',async event=>{
 event.preventDefault();
 message.textContent='Signing in…';
 try{
  const password=document.querySelector('#password').value;
  const login=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.querySelector('#email').value.trim(),password})});
  const credentials=await login.json();
  if(!login.ok)throw new Error(credentials.error||'Could not sign in.');
  if(!window.confirm('Permanently delete this Guide Voyager account and its account-linked server data? This cannot be undone.')){message.textContent='Deletion cancelled.';return;}
  message.textContent='Deleting account…';
  const deletion=await fetch('/api/auth/account',{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:`Bearer ${credentials.token}`},body:JSON.stringify({password})});
  const result=await deletion.json();
  if(!deletion.ok)throw new Error(result.error||'Could not delete account.');
  form.reset();
  message.textContent='Your account and account-linked server data have been deleted.';
 }catch(error){message.textContent=error.message||'Could not complete the request. Please try again.';}
});
