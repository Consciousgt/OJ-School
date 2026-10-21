/**
 * OJ SCHOOLS - Authentication & Session Security Handler
 */

const AUTH_KEY = "oj_schools_admin_session";

const ADMIN_CREDENTIALS = [
  {
    username: "admin",
    password: "ojschools2025",
    role: "Super Administrator",
    name: "Principal Administrator",
    avatar: "A"
  },
  {
    username: "bursar",
    password: "bursar123",
    role: "Chief Bursary Officer",
    name: "OJ Schools Bursar",
    avatar: "B"
  },
  {
    username: "records",
    password: "records123",
    role: "Academic Records Officer",
    name: "Academic Secretary",
    avatar: "R"
  }
];

class OJSchoolsAuth {
  static checkAuth() {
    const session = sessionStorage.getItem(AUTH_KEY);
    if (!session) {
      const path = window.location.pathname;
      if (path.endsWith("dashboard.html")) {
        window.location.href = "admin/index.html";
      }
      return null;
    }
    try {
      return JSON.parse(session);
    } catch (e) {
      this.logout();
      return null;
    }
  }

  static login(username, password) {
    const user = ADMIN_CREDENTIALS.find(
      u =>
        u.username.toLowerCase() === username.trim().toLowerCase() &&
        u.password === password
    );
    if (user) {
      const sessionData = {
        username: user.username,
        role: user.role,
        name: user.name,
        avatar: user.avatar,
        loginTime: new Date().toISOString()
      };
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(sessionData));
      sessionStorage.setItem("oj_schools_admin_name", user.name);
      sessionStorage.setItem("oj_schools_admin_role", user.role);
      return { success: true, user: sessionData };
    }
    return {
      success: false,
      message: "Invalid credentials. Please check your username and password."
    };
  }

  static logout() {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem("oj_schools_admin_name");
    sessionStorage.removeItem("oj_schools_admin_role");
    window.location.href = "admin/index.html";
  }

  static getCurrentUser() {
    const session = sessionStorage.getItem(AUTH_KEY);
    if (session) {
      try {
        return JSON.parse(session);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}

if (typeof window !== "undefined") {
  window.OJSchoolsAuth = OJSchoolsAuth;
}
