import React from 'react'
import { format } from "date-fns"
import { useState, useEffect } from 'react'
import { Button } from '../../@/components/ui/button'
import { Textarea } from '../../@/components/ui/textarea'
import { Card, CardContent } from '../../@/components/ui/card'
import { Calendar, Clock, User, Video, X, Stethoscope, Edit, Loader2, CheckCircle } from "lucide-react"
import { Badge } from '../../@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../@/components/ui/dialog'
 import { 
    cancelAppointment, 
    markAppointmentCompleted, 
    addAppointmentNotes
} from '@/action/doctor'
import 


const Appointmentcard = () => {
  return (
    <div>
      
    </div>
  )
}

export default Appointmentcard
