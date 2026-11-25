// --- backend/admin-tools.web.js ---

import { Permissions, webMethod } from 'wix-web-module';
import { authentication } from 'wix-members-backend';
import wixData from 'wix-data';

// 🌟 The 'webMethod' wrapper ensures ONLY you (the Admin) can fire this code!
export const registerCustomerFromHQ = webMethod(Permissions.Admin, async (customerData) => {
    try {
        console.log(`📌 [BACKEND_ADMIN_TOOLS -> registerCustomerFromHQ]: Registering customer ${customerData?.email || "unknown"}`);

        // 1. Silently create the Member Account & PIN
        const registrationResult = await authentication.register(customerData.email, customerData.password, {
            contactInfo: {
                firstName: customerData.firstName,
                lastName: customerData.lastName,
                phones: [customerData.phone]
            }
        });

        const newUserId = registrationResult.member._id;

        // 🌟 2. Split the data into Contacts, Locations, and Profiles!
        const contactPayload = {
            userId: newUserId,
            firstName: customerData.firstName,
            lastName: customerData.lastName,
            phone: customerData.phone,
            email: customerData.email,
            isPrimary: true
        };

        const locationPayload = {
            userId: newUserId,
            address1: customerData.address1,
            address2: customerData.address2,
            city: customerData.city,
            state: customerData.state,
            zip: customerData.zip,
            isPrimary: true
        };

        const profilePayload = {
            _id: newUserId, 
            firstName: customerData.firstName, 
            lastName: customerData.lastName,
            phone: customerData.phone, 
            email: customerData.email, 
            address1: customerData.address1, 
            address2: customerData.address2,
            city: customerData.city, 
            state: customerData.state, 
            zip: customerData.zip,
            activeSubscription: false
        };

        // Save them all!
        await wixData.insert("customerContacts", contactPayload);
        await wixData.insert("customerProfiles", profilePayload);
        const savedAddress = await wixData.insert("customerLocations", locationPayload);

        console.log(`📌 [BACKEND_ADMIN_TOOLS -> registerCustomerFromHQ]: Success! Created userId=${newUserId}, addressId=${savedAddress._id}`);
        return { success: true, userId: newUserId, addressId: savedAddress._id };
        
    } catch (error) {
        console.error("📌 [BACKEND_ADMIN_TOOLS -> registerCustomerFromHQ]: Backend Registration Error:", error);
        return { success: false, message: error.message };
    }
});