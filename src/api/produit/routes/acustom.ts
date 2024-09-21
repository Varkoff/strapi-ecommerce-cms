export default {
    routes: [
        {
            method: 'GET',
            path: '/produits/:slug',
            handler: 'api::produit.produit.findOne',
        },
        {
            method: 'POST',
            path: '/produits/update-products',
            handler: 'api::produit.produit.updateStripeProducts',
            config: {
                // policies: [],
                // middlewares: [],
                // auth: false
            },
        },
        {
            method: 'POST',
            path: '/produits/stripe',
            handler: 'api::produit.produit.handleStripeWebhooks',
            config: {
                // policies: [],
                // middlewares: [],
                auth: false
            },
        },

    ]
}