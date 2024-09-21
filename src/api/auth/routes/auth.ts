export default {
    routes: [
        {
            method: 'POST',
            path: '/auth/compare-passwords',
            handler: 'auth.comparePasswords',
        }
    ]
}