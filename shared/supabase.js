import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.0/+esm'

// Ganti dengan credentials Supabase Anda
const supabaseUrl = "https://kfkecsesdcxauhunstks.supabase.co";
const supabaseAnonKey = "sb_publishable_QIN8nMV5Z8XXhk9BYrpTfg_YbD7Q_6j";
// Inisialisasi Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Fungsi untuk login admin dengan Supabase Auth
async function adminLogin(email, password) {
  try {
    // Sign in dengan Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    })
    
    if (error) throw error
    
    if (data.user) {
      // Cek apakah user ada di admin_profiles
      const { data: profile, error: profileError } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()
      
      if (profileError) {
        console.warn('Admin profile not found, creating...')
        // Buat profile jika belum ada
        await createAdminProfile(data.user)
      }
      
      // Simpan session ke localStorage
      localStorage.setItem('admin_auth', JSON.stringify({
        userId: data.user.id,
        email: data.user.email,
        loggedIn: true,
        session: data.session
      }))
      
      return { success: true, user: data.user, session: data.session }
    }
    
    return { success: false, error: 'Login failed' }
    
  } catch (error) {
    console.error('Login error:', error.message)
    return { success: false, error: error.message }
  }
}

// Fungsi untuk membuat admin profile
async function createAdminProfile(user) {
  try {
    const { error } = await supabase
      .from('admin_profiles')
      .insert([{
        id: user.id,
        email: user.email,
        full_name: 'Administrator',
        role: 'admin'
      }])
    
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error creating admin profile:', error)
    return { success: false, error: error.message }
  }
}

// Fungsi untuk logout admin
async function adminLogout() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    
    localStorage.removeItem('admin_auth')
    window.location.href = 'login.html'
  } catch (error) {
    console.error('Logout error:', error)
    localStorage.removeItem('admin_auth')
    window.location.href = 'login.html'
  }
}

// Fungsi untuk memeriksa status login
async function checkAdminAuth() {
  try {
    // Cek localStorage
    const auth = localStorage.getItem('admin_auth')
    if (!auth) return false
    
    const authData = JSON.parse(auth)
    if (!authData.loggedIn || !authData.session) return false
    
    // Cek session validity dengan Supabase
    const { data, error } = await supabase.auth.getSession()
    
    if (error || !data.session) {
      localStorage.removeItem('admin_auth')
      return false
    }
    
    return true
    
  } catch (error) {
    console.error('Auth check error:', error)
    localStorage.removeItem('admin_auth')
    return false
  }
}

// Fungsi untuk mendapatkan current user
async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    return data.user
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

// Fungsi untuk sign up admin baru (hanya untuk development)
async function signUpAdmin(email, password, fullName = 'Administrator') {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: fullName,
          role: 'admin'
        }
      }
    })
    
    if (error) throw error
    
    if (data.user) {
      // Buat admin profile
      await createAdminProfile(data.user)
      return { success: true, user: data.user }
    }
    
    return { success: false, error: 'Signup failed' }
    
  } catch (error) {
    console.error('Signup error:', error)
    return { success: false, error: error.message }
  }
}

// Fungsi-fungsi lainnya tetap sama...
async function getRoads() {
  try {
    const { data, error } = await supabase
      .from('roads')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting roads:', error)
    return []
  }
}

async function addRoad(roadData) {
  try {
    const { data, error } = await supabase
      .from('roads')
      .insert([roadData])
      .select()
    
    if (error) throw error
    return { success: true, data: data[0] }
  } catch (error) {
    console.error('Error adding road:', error)
    return { success: false, error: error.message }
  }
}

async function updateRoad(id, updates) {
  try {
    const { data, error } = await supabase
      .from('roads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
    
    if (error) throw error
    return { success: true, data: data[0] }
  } catch (error) {
    console.error('Error updating road:', error)
    return { success: false, error: error.message }
  }
}

async function deleteRoad(id) {
  try {
    const { error } = await supabase
      .from('roads')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error deleting road:', error)
    return { success: false, error: error.message }
  }
}

async function getPublicReports(status = null) {
  try {
    let query = supabase
      .from('public_reports')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting public reports:', error)
    return []
  }
}

async function addPublicReport(reportData) {
  try {
    const { data, error } = await supabase
      .from('public_reports')
      .insert([reportData])
      .select()
    
    if (error) throw error
    return { success: true, data: data[0] }
  } catch (error) {
    console.error('Error adding public report:', error)
    return { success: false, error: error.message }
  }
}

async function updateReportStatus(id, status) {
  try {
    const { data, error } = await supabase
      .from('public_reports')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
    
    if (error) throw error
    return { success: true, data: data[0] }
  } catch (error) {
    console.error('Error updating report status:', error)
    return { success: false, error: error.message }
  }
}

// Fungsi untuk upload gambar
async function uploadImage(file, folder = 'public_reports') {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    
    const { data, error } = await supabase.storage
      .from('road-images')
      .upload(fileName, file)
    
    if (error) throw error
    
    // Dapatkan URL publik
    const { data: { publicUrl } } = supabase.storage
      .from('road-images')
      .getPublicUrl(data.path)
    
    return { success: true, url: publicUrl }
  } catch (error) {
    console.error('Error uploading image:', error)
    return { success: false, error: error.message }
  }
}

export {
  supabase,
  // Auth functions
  adminLogin,
  adminLogout,
  checkAdminAuth,
  getCurrentUser,
  signUpAdmin,
  // Data functions
  getRoads,
  addRoad,
  updateRoad,
  deleteRoad,
  getPublicReports,
  addPublicReport,
  updateReportStatus,
  uploadImage
}