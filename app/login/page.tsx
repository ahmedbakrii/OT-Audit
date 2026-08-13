'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User, Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('ot_user');

    if (user) {
      router.push('/');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      const { data: user, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('user_name', userName)
        .eq('is_active', true)
        .single();

      if (dbError || !user) {
        throw new Error(
          'اسم المستخدم غير صحيح أو الحساب موقوف.'
        );
      }

      if (user.password !== password) {
        throw new Error(
          'كلمة المرور غير صحيحة.'
        );
      }

      const sessionData = {
        id: user.id,
        name: user.name,
        role: user.role,
        userName: user.user_name,
      };

      localStorage.setItem(
        'ot_user',
        JSON.stringify(sessionData)
      );

      window.dispatchEvent(
        new Event('user_login_changed')
      );

      router.push('/');

    } catch (err: any) {
      setError(
        err.message ||
        'حدث خطأ في تسجيل الدخول.'
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="
        min-h-screen
        bg-slate-100
        flex
        items-center
        justify-center
        p-4
      "
    >

      <div
        className="
          bg-white
          w-full
          max-w-md
          rounded-2xl
          shadow-xl
          overflow-hidden
          flex
          flex-col
          border
          border-slate-200
        "
      >

        {/* LOGO HEADER */}
        <div
          className="
            bg-white
            px-8
            pt-10
            pb-8
            text-center
            relative
            overflow-hidden
            border-b
            border-slate-100
          "
        >

          <div className="relative z-10 flex flex-col items-center">

            <div
              className="
                w-full
                flex
                justify-center
                items-center
              "
            >
              <img
                src="/log-logo.png"
                alt="StaffCore"
                className="
                  h-28
                  w-auto
                  max-w-[280px]
                  object-contain
                "
              />
            </div>

            <p
              className="
                text-slate-500
                text-sm
                mt-3
                font-medium
              "
            >
              النظام المركزي لإدارة العمليات وشؤون العاملين
            </p>

          </div>

          {/* Decorative elements */}
          <div
            className="
              absolute
              -bottom-16
              -right-16
              w-40
              h-40
              bg-blue-500
              rounded-full
              blur-3xl
              opacity-10
            "
          />

          <div
            className="
              absolute
              -top-16
              -left-16
              w-40
              h-40
              bg-orange-500
              rounded-full
              blur-3xl
              opacity-10
            "
          />

        </div>

        {/* LOGIN FORM */}
        <form
          onSubmit={handleLogin}
          className="
            p-8
            flex
            flex-col
            space-y-5
          "
        >

          {/* ERROR */}
          {error && (
            <div
              className="
                bg-red-50
                text-red-600
                p-3
                rounded-lg
                text-sm
                font-bold
                text-center
                border
                border-red-100
              "
            >
              {error}
            </div>
          )}

          {/* USERNAME */}
          <div>

            <label
              className="
                block
                text-sm
                font-bold
                text-slate-700
                mb-1
              "
            >
              اسم المستخدم
            </label>

            <div className="relative">

              <User
                size={18}
                className="
                  absolute
                  right-3
                  top-3
                  text-slate-400
                "
              />

              <input
                type="text"
                value={userName}
                onChange={(e) =>
                  setUserName(e.target.value)
                }
                placeholder="أدخل اسم المستخدم"
                className="
                  w-full
                  border
                  border-slate-300
                  rounded-xl
                  pr-10
                  pl-4
                  py-2.5
                  outline-none
                  focus:ring-2
                  focus:ring-blue-500
                  focus:border-blue-500
                  bg-slate-50
                  focus:bg-white
                  transition
                "
                required
              />

            </div>

          </div>

          {/* PASSWORD */}
          <div>

            <label
              className="
                block
                text-sm
                font-bold
                text-slate-700
                mb-1
              "
            >
              كلمة المرور
            </label>

            <div className="relative">

              <Lock
                size={18}
                className="
                  absolute
                  right-3
                  top-3
                  text-slate-400
                "
              />

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="••••••••"
                className="
                  w-full
                  border
                  border-slate-300
                  rounded-xl
                  pr-10
                  pl-4
                  py-2.5
                  outline-none
                  focus:ring-2
                  focus:ring-blue-500
                  focus:border-blue-500
                  bg-slate-50
                  focus:bg-white
                  transition
                  text-left
                "
                dir="ltr"
                required
              />

            </div>

          </div>

          {/* LOGIN BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="
              w-full
              bg-orange-500
              text-white
              py-3
              rounded-xl
              hover:bg-orange-600
              active:bg-orange-700
              transition
              font-bold
              flex
              items-center
              justify-center
              gap-2
              mt-4
              shadow-md
              hover:shadow-lg
              disabled:opacity-70
              disabled:cursor-not-allowed
            "
          >

            {loading ? (
              <Loader2
                size={20}
                className="animate-spin"
              />
            ) : (
              <>
                <span>
                  تسجيل الدخول
                </span>

                <ArrowRight size={18} />
              </>
            )}

          </button>

        </form>

      </div>

    </div>
  );
}