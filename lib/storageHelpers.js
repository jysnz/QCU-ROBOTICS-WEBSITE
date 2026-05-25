import { supabase } from './supabaseClient'

// Upload a member profile picture and return the public URL
export async function uploadMemberAvatar(file, memberId) {
  const fileExt = file.name.split('.').pop()
  const filePath = `member-${memberId}-${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('member-avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('member-avatars')
    .getPublicUrl(filePath)

  return data.publicUrl
}

// Upload a match video and return the public URL
export async function uploadMatchVideo(file, matchName) {
  const fileExt = file.name.split('.').pop()
  const filePath = `match-${matchName.replace(/\s+/g, '-')}-${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('match-videos')
    .upload(filePath, file, { upsert: true })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('match-videos')
    .getPublicUrl(filePath)

  return data.publicUrl
}