# CropFlow – Testing and Improvement Checklist

## 1. Already Tested

* [x] Farmer dashboard loads.
* [x] Crop registration works and data persists after refresh.
* [x] Navigation and logout work.
* [x] Token and queue page loads.
* [x] Payments page displays the empty state correctly.
* [x] Mobile login, My Crops, Book Slot and Payments fit the screen.
* [x] Frontend production build succeeds.

## 2. Changes Needed

### Booking

* [ ] Fix outdated procurement slot dates.
* [ ] Ensure future booking slots are available.
* [ ] Test booking confirmation and token creation.

### Token and Queue

* [ ] Fix progress tracker overflow on mobile.
* [ ] Test live queue updates.
* [ ] Check token status changes.

### Payments

* [ ] Test payment history after procurement.
* [ ] Verify payment details are displayed correctly.

### Mobile

* [ ] Review dashboard layout, including the token progress tracker.

### Backend

* [ ] Coordinate the seed.js changes with the backend teammate.
* [ ] Check possible failures between booking and token creation.
