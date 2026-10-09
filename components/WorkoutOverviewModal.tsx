import React from 'react';
import { DailySummary, WorkoutItem } from '../types';
import { Portal } from './Portal';
import { StreakFlame } from './StreakFlame';
import { localDateString } from '../utils/dateUtils';
// Actually StreakFlame is likely not exported from BentoGrid based on previous reads. 
// I should check if StreakFlame is exported or just inline.
// It was imported in BentoGrid: import { StreakFlame } from './StreakFlame'; 
// So I can import it directly.

interface WorkoutOverviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Merged history including today's live data
    history: DailySummary[];
    // Today's specific workouts for detailed view
    todayWorkouts: WorkoutItem[];
    streak: number;
}

export const WorkoutOverviewModal: React.FC<WorkoutOverviewModalProps> = ({
    isOpen,
    onClose,
    history,
    todayWorkouts,
    streak
}) => {
    if (!isOpen) return null;

    // Calculate some aggregate stats for the header
    const totalWorkouts = history.reduce((acc, day) => acc + day.workoutCount, 0);
    const totalCalories = history.reduce((acc, day) => acc + day.caloriesBurned, 0);

    // Group history by month for a nicer list? 
    // For now, simple list is fine.

    // Filter out days with 0 activity to keep the list relevant
    const activeDays = history.filter(day => day.workoutCount > 0 || day.caloriesBurned > 0);

    return (
        <Portal>
            <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm px-4 py-4 animate-fade-in"
                onClick={onClose}
            >
                <div
                    className="bg-[var(--background)] w-full max-w-lg rounded-3xl border border-border shadow-2xl overflow-hidden backdrop-blur-md flex flex-col max-h-[85vh]"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-border/50 shrink-0">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-charcoal dark:text-stone-200 font-serif flex items-center gap-2">
                                    <span className="text-flame">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                            <path d="M15.232 5.232l3.536 3.536a2.5 2.5 0 1 1-3.536 3.536L6.5 3.5 3.5 6.5l8.732 8.732a2.5 2.5 0 1 1-3.536 3.536L5.232 15.232l-1.768 1.768a2.5 2.5 0 0 0 3.536 3.536l1.768-1.768 8.732 8.732 3-3-8.732-8.732 1.768-1.768a2.5 2.5 0 1 1 3.536 3.536l-1.768-1.768 3.536-3.536-1.768-1.768z" />
                                        </svg>
                                    </span>
                                    Activity Log
                                </h2>
                                <div className="flex gap-4 mt-2 text-xs font-bold uppercase tracking-wider text-muted">
                                    <span>{totalWorkouts} Workouts</span>
                                    <span>{totalCalories} Active Kcal</span>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 bg-[var(--input-bg)] border border-transparent rounded-full text-muted hover:text-[var(--text-main)] transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        {/* Streak Banner */}
                        {streak > 0 && (
                            <div className="mt-4 bg-flame/10 border border-flame/20 rounded-xl p-3 flex items-center gap-3">
                                <div className="p-2 bg-flame text-white rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2c-.3 0-.6.1-.9.4-1.2 1.3-2.6 3.3-3.1 5.6-.2 1-.2 2.3.5 3.5.7 1.2 2 2.2 3.4 2.5 1.5.3 3 .1 4.2-.7 1.2-.8 2-2.1 2.3-3.5.3-1.4.1-2.9-.6-4.2-.7-1.3-1.8-2.4-3.1-3.2-.8-.6-1.7-1-2.7-1.1zm.5 12.8c-1.2.6-2.5.5-3.6-.2-1.1-.7-1.8-1.9-1.9-3.2 0-.8.2-1.6.5-2.3-1.1 1.7-1.5 3.8-1.1 5.9.4 2.1 1.9 3.9 3.9 4.7 2 .8 4.3.4 6-1 .2-.2.4-.4.6-.6-.1.1-.2.2-.4.3-1.1.7-2.6.9-4 .4z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-flame font-bold text-sm">{streak} Day Streak!</p>
                                    <p className="text-xs text-muted">Keep the fire burning.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-0">
                        {/* Today's Detailed View */}
                        {todayWorkouts.length > 0 && (
                            <div className="p-6 pb-2">
                                <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-3 sticky top-0 bg-[var(--background)] py-2 z-10">Today</h3>
                                <div className="space-y-3">
                                    {todayWorkouts.map((workout) => (
                                        <div key={workout.id} className="flex items-center justify-between p-4 rounded-2xl bg-[var(--input-bg)] border border-border">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-workout/10 flex items-center justify-center text-workout">
                                                    {workout.type.toLowerCase() === 'walking' ? (
                                                        <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                                                            <path d="M10.1 3A1.9 1.9 0 1 1 12 4.9 1.899 1.899 0 0 1 10.1 3zm6.257 13.26l-2.425-3.377-.293-5.403c-.067-1.287-1.823-1.449-3.401-1.579-.945 1.6-2.48 4.575-3.125 5.838a.721.721 0 0 0 .265.942.74.74 0 0 0 1.033-.264l2.104-3.72.258 4.338 3.47 4.144 1.724 4.858a1.088 1.088 0 0 0 2.081-.496.953.953 0 0 0-.03-.202c-.03-.113-1.66-5.078-1.66-5.078zm-6.014-2.18l1.581 1.887-.335 1.588-3.227 4.285a1.087 1.087 0 1 1-1.808-1.2l3.065-4.285zM18 10.936a.881.881 0 0 1-.824 1.51c-.611-.37-2.35-1.536-2.35-1.536l-.104-1.926z" />
                                                            <path fill="none" d="M0 0h24v24H0z" />
                                                        </svg>
                                                    ) : workout.type.toLowerCase().includes('hiit') ? (
                                                        <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                                                            viewBox="0 0 491 491" style={{ enableBackground: 'new 0 0 491 491' }} xmlSpace="preserve" fill="currentColor" width="20" height="20">
                                                            <g>
                                                                <g>
                                                                    <g>
                                                                        <g>
                                                                            <path d="M182.5,387.344v-221l-56.3,77.1c-4.2,5.2-10.4,8.3-16.7,8.3H20.9c-11.5,0-20.9-9.4-20.9-20.9s9.4-20.9,20.9-20.9h78.2
                                                                                l86.5-118.9c5.2-7.3,14.6-10.4,22.9-7.3c8.3,3.1,14.6,10.4,14.6,19.8v204.3l64.6-117.8c11.1-16.8,26.6-10.5,32.3-4.2l39.6,38.6
                                                                                h110.5c11.5,0,20.9,9.4,20.9,20.9s-9.4,20.9-20.9,20.9H351.4c-5.2,0-10.4-2.1-14.6-6.3l-25-26.1l-89.7,163.7
                                                                                C215.3,410.544,185.1,416.944,182.5,387.344z"/>
                                                                        </g>
                                                                    </g>
                                                                </g>
                                                            </g>
                                                        </svg>
                                                    ) : workout.type.toLowerCase().includes('rowing') ? (
                                                        <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor">
                                                            <path d="M 436 188 L 435 189 L 429 189 L 428 190 L 425 190 L 424 191 L 422 191 L 421 192 L 419 192 L 418 193 L 417 193 L 416 194 L 415 194 L 414 195 L 413 195 L 412 196 L 411 196 L 409 198 L 408 198 L 406 200 L 405 200 L 394 211 L 394 212 L 392 214 L 392 215 L 390 217 L 390 218 L 389 219 L 389 220 L 388 221 L 388 222 L 387 223 L 387 225 L 386 226 L 386 228 L 385 229 L 385 231 L 384 232 L 269 232 L 269 234 L 270 235 L 270 238 L 271 239 L 271 253 L 270 254 L 270 257 L 269 258 L 269 259 L 384 259 L 385 260 L 385 262 L 386 263 L 386 265 L 387 266 L 387 268 L 388 269 L 388 270 L 389 271 L 389 272 L 390 273 L 390 274 L 392 276 L 392 277 L 393 278 L 393 279 L 397 283 L 397 284 L 402 289 L 403 289 L 406 292 L 407 292 L 409 294 L 409 298 L 408 299 L 408 301 L 407 302 L 407 304 L 406 305 L 406 308 L 405 309 L 405 311 L 404 312 L 404 315 L 403 316 L 403 318 L 402 319 L 402 321 L 401 322 L 401 325 L 400 326 L 400 328 L 399 329 L 399 332 L 398 333 L 398 335 L 397 336 L 397 338 L 396 339 L 396 342 L 395 343 L 395 345 L 394 346 L 394 348 L 393 349 L 393 352 L 392 353 L 392 355 L 391 356 L 391 359 L 390 360 L 390 362 L 389 363 L 389 365 L 388 366 L 388 369 L 387 370 L 387 372 L 386 373 L 386 375 L 385 376 L 385 379 L 384 380 L 384 382 L 383 383 L 383 386 L 382 387 L 382 389 L 381 390 L 381 392 L 380 393 L 380 396 L 379 397 L 379 399 L 378 400 L 378 403 L 377 404 L 377 406 L 376 407 L 161 407 L 152 398 L 151 398 L 139 386 L 138 386 L 131 379 L 130 379 L 129 378 L 128 378 L 127 377 L 124 377 L 123 376 L 26 376 L 25 377 L 23 377 L 22 378 L 21 378 L 20 379 L 19 379 L 16 382 L 16 383 L 14 385 L 14 387 L 13 388 L 13 434 L 14 435 L 14 437 L 15 438 L 15 439 L 20 444 L 22 444 L 23 445 L 25 445 L 26 446 L 394 446 L 395 445 L 398 445 L 399 444 L 400 444 L 402 442 L 403 442 L 406 439 L 406 438 L 408 436 L 408 435 L 409 434 L 409 432 L 410 431 L 410 429 L 411 428 L 411 425 L 412 424 L 412 422 L 413 421 L 413 418 L 414 417 L 414 415 L 415 414 L 415 411 L 416 410 L 416 408 L 417 407 L 417 405 L 418 404 L 418 401 L 419 400 L 419 398 L 420 397 L 420 394 L 421 393 L 421 391 L 422 390 L 422 388 L 423 387 L 423 384 L 424 383 L 424 381 L 425 380 L 425 377 L 426 376 L 426 374 L 427 373 L 427 371 L 428 370 L 428 367 L 429 366 L 429 364 L 430 363 L 430 360 L 431 359 L 431 357 L 432 356 L 432 354 L 433 353 L 433 350 L 434 349 L 434 347 L 435 346 L 435 343 L 436 342 L 436 340 L 437 339 L 437 337 L 438 336 L 438 333 L 439 332 L 439 330 L 440 329 L 440 326 L 441 325 L 441 323 L 442 322 L 442 320 L 443 319 L 443 316 L 444 315 L 444 313 L 445 312 L 445 309 L 446 308 L 446 306 L 447 305 L 447 304 L 448 303 L 451 303 L 452 302 L 455 302 L 456 301 L 458 301 L 459 300 L 461 300 L 462 299 L 463 299 L 464 298 L 466 298 L 468 296 L 469 296 L 470 295 L 471 295 L 473 293 L 474 293 L 476 291 L 477 291 L 485 283 L 485 282 L 488 279 L 488 278 L 490 276 L 490 275 L 491 274 L 491 273 L 492 272 L 492 271 L 493 270 L 493 269 L 494 268 L 494 266 L 495 265 L 495 264 L 496 263 L 496 260 L 497 259 L 497 254 L 498 253 L 498 239 L 497 238 L 497 233 L 496 232 L 496 230 L 495 229 L 495 226 L 494 225 L 494 224 L 493 223 L 493 222 L 492 221 L 492 219 L 490 217 L 490 216 L 489 215 L 489 214 L 487 212 L 487 211 L 483 207 L 483 206 L 481 204 L 480 204 L 475 199 L 474 199 L 472 197 L 471 197 L 469 195 L 468 195 L 467 194 L 466 194 L 465 193 L 463 193 L 462 192 L 460 192 L 459 191 L 457 191 L 456 190 L 453 190 L 452 189 L 446 189 L 445 188 Z" fill="currentColor" />
                                                            <path d="M 92 175 L 91 176 L 87 176 L 86 177 L 84 177 L 83 178 L 82 178 L 81 179 L 80 179 L 79 180 L 78 180 L 77 181 L 76 181 L 74 183 L 73 183 L 65 191 L 65 192 L 63 194 L 63 195 L 62 196 L 62 197 L 61 198 L 61 199 L 60 200 L 60 201 L 59 202 L 59 204 L 58 205 L 58 207 L 57 208 L 57 210 L 56 211 L 56 214 L 55 215 L 55 217 L 54 218 L 54 220 L 53 221 L 53 223 L 52 224 L 52 227 L 51 228 L 51 230 L 50 231 L 50 233 L 49 234 L 49 236 L 48 237 L 48 240 L 47 241 L 47 243 L 46 244 L 46 246 L 45 247 L 45 249 L 44 250 L 44 253 L 43 254 L 43 256 L 42 257 L 42 259 L 41 260 L 41 262 L 40 263 L 40 266 L 39 267 L 39 269 L 38 270 L 38 272 L 37 273 L 37 275 L 36 276 L 36 279 L 35 280 L 35 282 L 34 283 L 34 285 L 33 286 L 33 288 L 32 289 L 32 292 L 31 293 L 31 295 L 30 296 L 30 298 L 29 299 L 29 301 L 28 302 L 28 305 L 27 306 L 27 313 L 26 314 L 26 315 L 27 316 L 27 323 L 28 324 L 28 327 L 29 328 L 29 329 L 30 330 L 30 331 L 31 332 L 31 333 L 32 334 L 32 335 L 33 336 L 33 337 L 36 340 L 36 341 L 40 345 L 41 345 L 44 348 L 45 348 L 46 349 L 47 349 L 48 350 L 49 350 L 50 351 L 51 351 L 52 352 L 53 352 L 54 353 L 57 353 L 58 354 L 107 354 L 108 353 L 115 353 L 116 352 L 119 352 L 120 351 L 123 351 L 124 350 L 128 350 L 129 349 L 132 349 L 133 348 L 136 348 L 137 347 L 140 347 L 141 346 L 145 346 L 146 345 L 149 345 L 150 344 L 153 344 L 154 343 L 158 343 L 159 342 L 160 342 L 161 343 L 162 343 L 165 346 L 166 346 L 169 349 L 170 349 L 173 352 L 174 352 L 177 355 L 178 355 L 181 358 L 182 358 L 185 361 L 186 361 L 189 364 L 190 364 L 193 367 L 194 367 L 197 370 L 198 370 L 201 373 L 202 373 L 205 376 L 206 376 L 209 379 L 210 379 L 213 382 L 214 382 L 217 385 L 218 385 L 220 387 L 221 387 L 222 388 L 223 388 L 224 389 L 225 389 L 226 390 L 229 390 L 230 391 L 240 391 L 241 390 L 243 390 L 244 389 L 246 389 L 247 388 L 248 388 L 250 386 L 251 386 L 256 381 L 256 380 L 257 379 L 257 378 L 258 377 L 258 376 L 259 375 L 259 374 L 260 373 L 260 370 L 261 369 L 261 362 L 260 361 L 260 358 L 259 357 L 259 355 L 258 354 L 258 353 L 257 352 L 257 351 L 256 350 L 256 349 L 248 341 L 247 341 L 244 338 L 243 338 L 240 335 L 239 335 L 236 332 L 235 332 L 232 329 L 231 329 L 227 325 L 226 325 L 223 322 L 222 322 L 219 319 L 218 319 L 215 316 L 214 316 L 210 312 L 209 312 L 206 309 L 205 309 L 202 306 L 201 306 L 198 303 L 197 303 L 198 300 L 197 300 L 189 296 L 188 296 L 185 293 L 184 293 L 182 291 L 181 291 L 180 290 L 179 290 L 178 289 L 177 289 L 176 288 L 174 288 L 173 287 L 160 287 L 159 288 L 155 288 L 154 289 L 151 289 L 150 290 L 147 290 L 146 291 L 142 291 L 141 292 L 138 292 L 137 293 L 134 293 L 133 294 L 129 294 L 128 295 L 125 295 L 124 296 L 121 296 L 120 297 L 117 297 L 116 296 L 116 294 L 117 293 L 117 291 L 118 290 L 118 289 L 119 288 L 119 286 L 120 285 L 120 284 L 121 283 L 121 281 L 122 280 L 122 278 L 123 277 L 123 276 L 124 275 L 124 273 L 125 272 L 125 270 L 126 269 L 126 268 L 127 267 L 127 265 L 128 264 L 128 262 L 129 261 L 129 260 L 130 259 L 130 257 L 131 256 L 131 255 L 132 254 L 132 252 L 133 251 L 133 249 L 134 248 L 134 247 L 135 246 L 135 244 L 137 242 L 138 242 L 141 245 L 142 245 L 145 248 L 146 248 L 149 251 L 150 251 L 153 254 L 154 254 L 158 258 L 159 258 L 162 261 L 163 261 L 166 264 L 167 264 L 168 265 L 169 265 L 170 266 L 171 266 L 172 267 L 175 267 L 176 268 L 230 268 L 231 267 L 235 267 L 236 266 L 237 266 L 238 265 L 239 265 L 240 264 L 241 264 L 247 258 L 247 257 L 248 256 L 248 255 L 249 254 L 249 252 L 250 251 L 250 242 L 249 241 L 249 238 L 248 237 L 248 236 L 246 234 L 246 233 L 241 228 L 240 228 L 238 226 L 236 226 L 235 225 L 232 225 L 231 224 L 185 224 L 182 221 L 181 221 L 177 217 L 176 217 L 173 214 L 172 214 L 169 211 L 168 211 L 164 207 L 163 207 L 160 204 L 159 204 L 156 201 L 155 201 L 151 197 L 150 197 L 147 194 L 146 194 L 143 191 L 142 191 L 140 189 L 139 189 L 138 188 L 137 188 L 135 186 L 134 186 L 133 185 L 132 185 L 131 184 L 130 184 L 129 183 L 128 183 L 127 182 L 125 182 L 124 181 L 121 181 L 120 180 L 118 180 L 117 179 L 115 179 L 114 178 L 112 178 L 111 177 L 108 177 L 107 176 L 101 176 L 100 175 Z" fill="currentColor" />
                                                            <path d="M 153 65 L 152 66 L 147 66 L 146 67 L 143 67 L 142 68 L 140 68 L 139 69 L 137 69 L 136 70 L 134 70 L 132 72 L 131 72 L 130 73 L 129 73 L 128 74 L 127 74 L 124 77 L 123 77 L 115 85 L 115 86 L 112 89 L 112 90 L 110 92 L 110 93 L 109 94 L 109 95 L 108 96 L 108 97 L 107 98 L 107 100 L 106 101 L 106 103 L 105 104 L 105 107 L 104 108 L 104 114 L 103 115 L 103 125 L 104 126 L 104 131 L 105 132 L 105 135 L 106 136 L 106 138 L 107 139 L 107 141 L 108 142 L 108 143 L 109 144 L 109 145 L 110 146 L 110 147 L 112 149 L 112 150 L 115 153 L 115 154 L 123 162 L 124 162 L 127 165 L 128 165 L 129 166 L 130 166 L 131 167 L 132 167 L 133 168 L 134 168 L 135 169 L 136 169 L 137 170 L 139 170 L 140 171 L 142 171 L 143 172 L 146 172 L 147 173 L 153 173 L 154 174 L 162 174 L 163 173 L 169 173 L 170 172 L 173 172 L 174 171 L 176 171 L 177 170 L 178 170 L 179 169 L 180 169 L 181 168 L 182 168 L 183 167 L 184 167 L 185 166 L 186 166 L 188 164 L 189 164 L 191 162 L 192 162 L 200 154 L 200 153 L 203 150 L 203 149 L 204 148 L 204 147 L 205 146 L 205 145 L 206 144 L 206 143 L 207 142 L 207 141 L 208 140 L 208 139 L 209 138 L 209 135 L 210 134 L 210 131 L 211 130 L 211 123 L 212 122 L 212 117 L 211 116 L 211 109 L 210 108 L 210 105 L 209 104 L 209 102 L 208 101 L 208 99 L 207 98 L 207 97 L 206 96 L 206 95 L 205 94 L 205 93 L 204 92 L 204 91 L 202 89 L 202 88 L 199 85 L 199 84 L 193 78 L 192 78 L 189 75 L 188 75 L 186 73 L 185 73 L 184 72 L 183 72 L 182 71 L 181 71 L 180 70 L 179 70 L 178 69 L 177 69 L 176 68 L 173 68 L 172 67 L 169 67 L 168 66 L 162 66 L 161 65 Z" fill="currentColor" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M20.2 17.6l-2.7-11.5c-.5-2.2-2.9-3.4-5-2.6C9.9 4.4 7.6 6.8 7.3 10.1L6.7 15l-3.3 1.3c-.9.4-1.3 1.4-1 2.3.2.6.7 1 1.3 1.2l4.8 1.4c.5.1 1 .2 1.5.2 2 0 3.9-1 5-2.7l4.3-1.7c.9-.4 1.3-1.4 1-2.3-.2-.5-.6-.9-1.1-1.1z" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-charcoal dark:text-stone-200">{workout.type}</p>
                                                    <p className="text-xs text-muted">
                                                        {new Date(workout.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-serif font-bold text-lg text-charcoal dark:text-stone-200">{workout.caloriesBurned}</p>
                                                <p className="text-[10px] font-bold text-muted uppercase">kcal</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* History List */}
                        <div className="p-6 pt-2">
                            <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-3 sticky top-0 bg-[var(--background)] py-2 z-10">History</h3>
                            <div className="space-y-2">
                                {activeDays.length === 0 ? (
                                    <div className="text-center py-8 text-muted">
                                        <p>No history yet.</p>
                                    </div>
                                ) : (
                                    activeDays.map((summary) => {
                                        const isToday = summary.date === localDateString();
                                        if (isToday) return null; // Already showed detailed view

                                        return (
                                            <div key={summary.date} className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--input-bg)] transition-colors border border-transparent hover:border-border">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-stone-100 dark:bg-white/5 border border-border">
                                                        <span className="text-[10px] font-bold text-muted uppercase">{new Date(summary.date).toLocaleString('en-US', { month: 'short' })}</span>
                                                        <span className="text-sm font-bold text-charcoal dark:text-stone-200">{new Date(summary.date).getDate()}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-charcoal dark:text-stone-200">{
                                                            summary.workoutTypes && summary.workoutTypes.length > 0
                                                                ? summary.workoutTypes.join(', ')
                                                                : `${summary.workoutCount} Workout${summary.workoutCount !== 1 ? 's' : ''}`
                                                        }</p>
                                                        <p className="text-xs text-muted">Daily Summary</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-serif font-bold text-charcoal dark:text-stone-200">{summary.caloriesBurned}</span>
                                                    <span className="text-xs text-muted ml-1">kcal</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
};
