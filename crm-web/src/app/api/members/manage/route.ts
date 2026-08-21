import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, memberId, newRole, newActive, adminPassword, newMemberPassword, permissions } = body

    if (!action || !memberId || !adminPassword) {
      return NextResponse.json({ error: 'Action, memberId, and admin password are required.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // 1. Verify Admin Password with Supabase Auth
    const authClient = createClient(supabaseUrl, anonKey)
    const { error: authError } = await authClient.auth.signInWithPassword({
      email: 'admin@mathsps.com',
      password: adminPassword
    })

    if (authError) {
      return NextResponse.json({ error: 'Incorrect Admin Password. Permission denied.' }, { status: 403 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    // 2. Perform requested management action
    if (action === 'update_role') {
      // Update role in members table
      const { data: member, error: dbErr } = await supabaseAdmin
        .from('members')
        .update({ role: newRole })
        .eq('id', memberId)
        .select()
        .single()

      if (dbErr) throw dbErr

      // If member has auth account, sync user_metadata role
      if (member.email) {
        const { data: users } = await supabaseAdmin.auth.admin.listUsers()
        const targetUser = users.users.find(u => u.email?.toLowerCase() === member.email?.toLowerCase())
        if (targetUser) {
          await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
            user_metadata: { ...targetUser.user_metadata, role: newRole }
          })
        }
      }

      return NextResponse.json({ success: true, member })
    }

    if (action === 'toggle_active') {
      const { data: member, error: dbErr } = await supabaseAdmin
        .from('members')
        .update({ active: newActive })
        .eq('id', memberId)
        .select()
        .single()

      if (dbErr) throw dbErr
      return NextResponse.json({ success: true, member })
    }

    if (action === 'update_permissions') {
      const notesStr = JSON.stringify(permissions || { allowed_members: [], can_view_all: false })

      const { data: member, error: dbErr } = await supabaseAdmin
        .from('members')
        .update({ notes: notesStr })
        .eq('id', memberId)
        .select()
        .single()

      if (dbErr) throw dbErr
      return NextResponse.json({ success: true, member })
    }

    if (action === 'reset_password') {
      const pass = newMemberPassword

      if (!pass || pass.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 })
      }

      const { data: member } = await supabaseAdmin.from('members').select('*').eq('id', memberId).single()
      if (!member?.email) {
        return NextResponse.json({ error: 'Member does not have an active login email account.' }, { status: 400 })
      }

      const { data: users } = await supabaseAdmin.auth.admin.listUsers()
      const targetUser = users.users.find(u => u.email?.toLowerCase() === member.email?.toLowerCase())
      if (!targetUser) {
        return NextResponse.json({ error: 'User account not found in Auth system.' }, { status: 404 })
      }

      const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        password: pass
      })

      if (resetErr) throw resetErr
      return NextResponse.json({ success: true, message: `Password reset successfully for ${member.name}` })
    }

    if (action === 'delete_member') {
      const { data: member } = await supabaseAdmin.from('members').select('*').eq('id', memberId).single()
      
      // Delete from members table
      const { error: dbErr } = await supabaseAdmin.from('members').delete().eq('id', memberId)
      if (dbErr) throw dbErr

      // If user had an Auth login account, remove from auth as well
      if (member?.email) {
        const { data: users } = await supabaseAdmin.auth.admin.listUsers()
        const targetUser = users.users.find(u => u.email?.toLowerCase() === member.email?.toLowerCase())
        if (targetUser && !targetUser.email?.includes('admin')) {
          await supabaseAdmin.auth.admin.deleteUser(targetUser.id)
        }
      }

      return NextResponse.json({ success: true, memberId })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}
