import { Metadata } from 'next'

import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Administration',
  description: 'Admin panel',
}

const AdminPage = () => {
  return redirect('/admin/users')
  // return <Client />
}

export default AdminPage
