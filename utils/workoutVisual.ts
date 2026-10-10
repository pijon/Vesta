import {
  IconActivity, IconBallBasketball, IconBallBowling, IconBallFootball, IconBallTennis, IconBallVolleyball,
  IconBarbell, IconBike, IconBolt, IconDog, IconFeather, IconGolf, IconHeartbeat, IconHorse, IconJumpRope,
  IconKarate, IconKayak, IconMountain, IconMusic, IconPingPong, IconRun, IconSailboat, IconScubaDiving,
  IconShovel, IconSkateboarding, IconSkiJumping, IconSnowboarding, IconStairsUp, IconStretching, IconSwimming,
  IconTrekking, IconWalk, IconYoga, type Icon,
} from '@tabler/icons-react';
import { compileIconRules, matchIcon, type IconRule } from './iconMatch';

/**
 * Workout-type icons (Tabler, which has the sport figures Lucide lacks), matched against whole
 * words in the workout name, English and common Swedish. Order matters: specific sports before
 * the general ones, so "trail running" is a run and "dog walk" a dog.
 */
const WORKOUT_RULES: IconRule<Icon>[] = [
  [IconDog, ['dog walk', 'walking the dog', 'walked the dog', 'hundpromenad']],
  [IconTrekking, ['hike', 'hiking', 'trek', 'trekking', 'fell walk', 'vandring', 'vandra']],
  [IconMountain, ['climb', 'climbing', 'bouldering', 'boulder', 'klättring']],
  [IconScubaDiving, ['diving', 'snorkel', 'snorkelling', 'dykning']],
  [IconSwimming, ['swim', 'swimming', 'lengths', 'aqua', 'aquafit', 'water aerobics', 'simning', 'simma', '-simning']],
  [IconKayak, ['kayak', 'kayaking', 'canoe', 'canoeing', 'paddle', 'paddleboard', 'sup', 'paddling', 'kajak', 'paddla']],
  [IconSailboat, ['sailing', 'segling']],
  [IconBike, ['cycle', 'cycling', 'bike', 'biking', 'spin', 'spinning', 'peloton', 'mtb', 'cykling', 'cykel', 'cykla', '-cykel', '-cykling']],
  [IconRun, ['run', 'running', 'jog', 'jogging', 'sprint', 'sprints', 'parkrun', '5k', '10k', 'marathon', 'löpning', 'jogga', 'springa', '-löpning']],
  [IconWalk, ['walk', 'walking', 'steps', 'stroll', 'promenad', 'promenera', 'gå', 'powerwalk', '-promenad']],
  [IconRun, ['treadmill', 'löpband']],
  [IconYoga, ['yoga', 'pilates', 'barre', 'tai chi', 'meditation']],
  [IconStretching, ['stretch', 'stretching', 'mobility', 'foam roll', 'foam rolling', 'physio', 'rehab', 'stretcha', 'rörlighet']],
  [IconBolt, ['hiit', 'circuit', 'circuits', 'crossfit', 'bootcamp', 'tabata', 'interval', 'intervals', 'burpees', 'body pump', 'bodypump', 'cirkelträning', 'intervaller']],
  [IconJumpRope, ['skipping', 'jump rope', 'hopprep']],
  [IconBarbell, ['weights', 'weight training', 'lifting', 'strength', 'gym', 'squats', 'deadlift', 'bench press', 'kettlebell', 'resistance', 'dumbbell', 'styrka', 'styrketräning', 'gymmet', 'gympass']],
  [IconStairsUp, ['stairs', 'stair climber', 'stairmaster', 'step class', 'trappor']],
  [IconHeartbeat, ['cardio', 'elliptical', 'cross trainer', 'crosstrainer', 'rowing', 'rower', 'row', 'erg', 'aerobics', 'rodd', 'roddmaskin', 'kondition']],
  [IconMusic, ['dance', 'dancing', 'zumba', 'ballet', 'dans', 'dansa']],
  [IconKarate, ['karate', 'judo', 'martial arts', 'taekwondo', 'kickboxing', 'boxing', 'jiu jitsu', 'bjj', 'mma', 'boxning', 'kampsport']],
  [IconBallFootball, ['football', 'soccer', 'futsal', 'fotboll']],
  [IconBallBasketball, ['basketball', 'netball', 'basket']],
  [IconBallVolleyball, ['volleyball', 'volleyboll']],
  [IconBallTennis, ['tennis', 'padel', 'squash', 'pickleball']],
  [IconFeather, ['badminton']],
  [IconPingPong, ['table tennis', 'ping pong', 'pingis', 'bordtennis']],
  [IconGolf, ['golf']],
  [IconBallBowling, ['bowling']],
  [IconSkiJumping, ['ski', 'skiing', 'cross country skiing', 'längdskidor', 'skidor', 'åka skidor', 'skid-']],
  [IconSnowboarding, ['snowboard', 'snowboarding']],
  [IconSkateboarding, ['skate', 'skating', 'skateboarding', 'rollerblading', 'ice skating', 'skridskor', 'inlines']],
  [IconHorse, ['riding', 'horse riding', 'equestrian', 'ridning']],
  [IconShovel, ['gardening', 'garden', 'shovelling', 'snow shovelling', 'trädgård', 'trädgårdsarbete', 'skotta']],
];

const WORKOUT_PATTERNS = compileIconRules(WORKOUT_RULES);

/** Icon for a workout from its name; a generic activity line when nothing matches. */
export const workoutIconFor = (type: string | undefined): Icon =>
  matchIcon(type || '', WORKOUT_PATTERNS) ?? IconActivity;
