export default function SimpleTest() {
  return (
    <div style={{ 
      padding: '40px', 
      fontFamily: 'Arial', 
      textAlign: 'center',
      backgroundColor: '#10b981',
      color: 'white',
      minHeight: '100vh'
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>✅ ES FUNKTIONIERT!</h1>
      <p style={{ fontSize: '24px' }}>Diese Seite verwendet KEIN Supabase.</p>
      <p style={{ fontSize: '18px', marginTop: '20px' }}>
        Wenn Sie diese Seite sehen können, funktioniert Vercel perfekt!
      </p>
      <p style={{ fontSize: '16px', marginTop: '40px', opacity: 0.8 }}>
        URL: gridbox-app.vercel.app/simple-test
      </p>
    </div>
  );
}

