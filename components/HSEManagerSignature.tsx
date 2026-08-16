import React from 'react';

export default function HSEManagerSignature({ approvalDate }: { approvalDate?: string }) {
  // تفكيك التاريخ ليوم، شهر، وسنة
  const dateObj = approvalDate ? new Date(approvalDate) : new Date();
  
  // 🔴 التعديل هنا: استخدام toString() فقط بدون padStart بيشيل الصفر اللي على الشمال أوتوماتيك
  const day = dateObj.getDate().toString(); 
  const month = (dateObj.getMonth() + 1).toString(); 
  const year = dateObj.getFullYear().toString();

  return (
    <div 
      className="relative flex justify-center items-center pointer-events-none" 
      style={{ width: '220px', height: '120px' }}
      dir="ltr" // إجبار المكون على الاتجاه الإنجليزي عشان الأرقام متتعكسش
    >
      {/* 1. الصورة الأصلية للإمضاء الجديدة */}
      <img 
        src="/Signature.png" 
        alt="Manager Signature" 
        className="absolute top-0 left-0 w-full h-full"
        style={{ 
          mixBlendMode: 'multiply', // إخفاء الخلفية البيضاء
          objectFit: 'contain',
          zIndex: 10
        }} 
      />

      {/* 2. التاريخ الدايناميك مقسم (يوم / شهر / سنة) وموزع بالمللي */}
      <div 
        className="absolute w-full h-full z-0 font-bold" 
        style={{
          fontFamily: "'Caveat', cursive",
          fontSize: '24px', 
          color: '#1a237e', // لون الحبر
          transform: 'rotate(-4deg)', // ميل يطابق ميل الإمضاء
        }}
      >
        {/* اليوم (أول خانة يسار) */}
        <span style={{ position: 'absolute', bottom: '15px', left: '16%' }}>
          {day}
        </span>
        
        {/* الشهر (في النص بين الـ / /) */}
        <span style={{ position: 'absolute', bottom: '15px', left: '38%', transform: 'translateX(-50%)' }}>
          {month}
        </span>
        
        {/* السنة (آخر خانة يمين) */}
        <span style={{ position: 'absolute', bottom: '15px', left: '52%' }}>
          {year}
        </span>
      </div>
    </div>
  );
}