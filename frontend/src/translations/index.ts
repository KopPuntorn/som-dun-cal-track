export const translations = {
    en: {
        // General
        appName: "SomDun",
        logout: "Logout",
        save: "Save",
        loading: "Loading...",
        error: "Error",
        back: "Back",

        // Bottom Nav
        navDashboard: "Dashboard",
        navAddFood: "Add Food",
        navProfile: "Profile",

        // Main Page (Tracker)
        calories: "Calories",
        protein: "Protein",
        fat: "Fat",
        consumed: "Consumed",
        remaining: "Remaining",
        over: "Over",
        addFood: "Add Food",
        quickAdd: "Quick Add",
        aiAdvice: "AI Expert Advice",
        getAdvice: "Get AI Advice",
        analyzing: "Analyzing...",

        // Analytics Page
        analyticsTitle: "Analytics Dashboard",
        historyTrends: "History & Trends",
        aiAnalyst: "AI Performance Analyst",
        getInsights: "Get Historical Insights",
        weightTrend: "Weight Trend (kg)",
        calorieTrend: "Calorie & Macro Trends",

        // Profile Page
        profileSettings: "Profile & Settings",
        dailyGoals: "Daily Nutritional Goals",
        userProfile: "User Profile",
        name: "Name",
        age: "Age",
        weight: "Weight",
        height: "Height",
        sex: "Sex",
        male: "Male",
        female: "Female",
        other: "Other",
        saveProfile: "Save Profile & Goals",
        saving: "Saving...",

        // Modals
        editFood: "Edit Food Entry",
        foodName: "Food Name (e.g. Chicken Rice)",
        category: "Category",
        breakfast: "Breakfast",
        lunch: "Lunch",
        dinner: "Dinner",
        snack: "Snack",
        cancel: "Cancel",

        // Login Page
        login: "Log In",
        signup: "Sign Up",
        email: "Email Address",
        password: "Password",
        fullName: "Full Name",
        continueWith: "Or continue with",
        signInGoogle: "Sign in with Google",
        signUpGoogle: "Sign up with Google",
        welcomeBack: "Sign in to your personalized dashboard",
    },
    th: {
        // General
        appName: "สมดุล (SomDun)",
        logout: "ออกจากระบบ",
        save: "บันทึก",
        loading: "กำลังโหลด...",
        error: "ข้อผิดพลาด",
        back: "ย้อนกลับ",

        // Bottom Nav
        navDashboard: "แดชบอร์ด",
        navAddFood: "เพิ่มอาหาร",
        navProfile: "โปรไฟล์",

        // Main Page (Tracker)
        calories: "แคลอรี่",
        protein: "โปรตีน",
        fat: "ไขมัน",
        consumed: "ทานไปแล้ว",
        remaining: "เหลือ",
        over: "เกิน",
        addFood: "เพิ่มอาหาร",
        quickAdd: "เพิ่มด่วน",
        aiAdvice: "คำแนะนำจาก AI",
        getAdvice: "ขอคำแนะนำจาก AI",
        analyzing: "กำลังวิเคราะห์...",

        // Analytics Page
        analyticsTitle: "แดชบอร์ดสถิติ",
        historyTrends: "ประวัติและแนวโน้ม",
        aiAnalyst: "AI วิเคราะห์ผลงาน",
        getInsights: "ดูข้อมูลเชิงลึก",
        weightTrend: "แนวโน้มน้ำหนัก (กก.)",
        calorieTrend: "แนวโน้มแคลอรี่และสารอาหาร",

        // Profile Page
        profileSettings: "โปรไฟล์และการตั้งค่า",
        dailyGoals: "เป้าหมายสารอาหารต่อวัน",
        userProfile: "ข้อมูลผู้ใช้งาน",
        name: "ชื่อ",
        age: "อายุ",
        weight: "น้ำหนัก",
        height: "ส่วนสูง",
        sex: "เพศ",
        male: "ชาย",
        female: "หญิง",
        other: "อื่นๆ",
        saveProfile: "บันทึกโปรไฟล์และเป้าหมาย",
        saving: "กำลังบันทึก...",

        // Modals
        editFood: "แก้ไขข้อมูลอาหาร",
        foodName: "ชื่ออาหาร (เช่น ข้าวมันไก่)",
        category: "มื้ออาหาร",
        breakfast: "มื้อเช้า",
        lunch: "มื้อกลางวัน",
        dinner: "มื้อเย็น",
        snack: "ของว่าง",
        cancel: "ยกเลิก",

        // Login Page
        login: "เข้าสู่ระบบ",
        signup: "สมัครสมาชิก",
        email: "อีเมล",
        password: "รหัสผ่าน",
        fullName: "ชื่อ-นามสกุล",
        continueWith: "หรือเข้าใช้งานด้วย",
        signInGoogle: "เข้าสู่ระบบด้วย Google",
        signUpGoogle: "สมัครสมาชิกด้วย Google",
        welcomeBack: "เข้าสู่หน้าแดชบอร์ดส่วนตัวของคุณ",
    }
};

export type Language = keyof typeof translations;
export type TranslationKeys = keyof typeof translations.en;
